"""Lightweight FastAPI health service for Jetson connectivity checks."""

from __future__ import annotations

import os
import re
import socket
import subprocess
from pathlib import Path
from time import time

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

STARTED_AT = time()

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))


def _parse_origins(raw_origins: str) -> list[str]:
	origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
	return origins or ["*"]


def _require_api_key(x_api_key: str | None) -> None:
	expected_key = os.getenv("HEALTH_API_KEY", "").strip()
	if not expected_key:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="HEALTH_API_KEY is not configured on server",
		)

	if x_api_key != expected_key:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid API key",
		)


def _read_tegrastats_sample() -> str | None:
	"""Read one tegrastats sample. Return None if unavailable."""

	def _to_text(raw: str | bytes | None) -> str:
		if raw is None:
			return ""
		if isinstance(raw, bytes):
			return raw.decode("utf-8", errors="ignore")
		return raw

	def _pick_sample(raw_text: str) -> str | None:
		lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
		if not lines:
			return None
		for line in lines:
			if "RAM" in line:
				return line
		return lines[0]

	def _run_once(args: list[str], timeout_sec: int = 2) -> str | None:
		try:
			result = subprocess.run(
				["tegrastats", *args],
				capture_output=True,
				text=True,
				check=False,
				timeout=timeout_sec,
			)
			raw_text = (_to_text(result.stdout) or _to_text(result.stderr)).strip()
			if "Unknown command" in raw_text:
				return None
			return _pick_sample(raw_text)
		except subprocess.TimeoutExpired as exc:
			raw_text = (_to_text(exc.stdout) + "\n" + _to_text(exc.stderr)).strip()
			if "Unknown command" in raw_text:
				return None
			return _pick_sample(raw_text)
		except (FileNotFoundError, OSError, subprocess.SubprocessError):
			return None

	# Newer tegrastats supports --count; older builds do not.
	for args in (["--interval", "1000", "--count", "1"], ["--interval", "1000"], []):
		sample = _run_once(args)
		if sample:
			return sample

	return None


def _parse_tegrastats_metrics(sample: str) -> dict[str, float | int | None]:
	gpu_percent: int | None = None
	vram_used_gb: float | None = None
	vram_total_gb: float | None = None
	temp_c: float | None = None
	power_w: float | None = None

	gpu_match = re.search(r"(?:GR3D_FREQ|GR3D)\s+(\d+)%", sample)
	if gpu_match:
		gpu_percent = int(gpu_match.group(1))

	ram_match = re.search(r"RAM\s+(\d+)\s*/\s*(\d+)\s*(MB|MiB|GB|GiB)", sample, re.IGNORECASE)
	if ram_match:
		ram_used_mb = int(ram_match.group(1))
		ram_total_mb = int(ram_match.group(2))
		unit = ram_match.group(3).lower()
		if unit in {"gb", "gib"}:
			ram_used_mb *= 1024
			ram_total_mb *= 1024
		vram_used_gb = round(ram_used_mb / 1024, 1)
		vram_total_gb = round(ram_total_mb / 1024, 1)

	temps = [float(value) for value in re.findall(r"[A-Za-z0-9_]+@(-?\d+(?:\.\d+)?)C", sample)]
	if temps:
		temp_c = round(max(temps), 1)

	vdd_in_match = re.search(r"VDD_IN\s+(\d+)mW/(\d+)mW", sample)
	if vdd_in_match:
		power_w = round(int(vdd_in_match.group(1)) / 1000, 1)
	else:
		pom_match = re.search(r"POM_5V_IN\s+(\d+)mW/(\d+)mW", sample)
		if pom_match:
			power_w = round(int(pom_match.group(1)) / 1000, 1)
		else:
			generic_power_match = re.search(
				r"(?:VDD_[A-Z0-9_]+|POM_[A-Z0-9_]+)\s+(\d+)mW/\d+mW",
				sample,
			)
			if generic_power_match:
				power_w = round(int(generic_power_match.group(1)) / 1000, 1)

	return {
		"gpu_percent": gpu_percent,
		"vram_used_gb": vram_used_gb,
		"vram_total_gb": vram_total_gb,
		"temp_c": temp_c,
		"power_w": power_w,
	}


def _collect_control_panel_metrics() -> dict[str, float | int | str | None]:
	default_power_budget = float(os.getenv("HEALTH_MAX_POWER_W", "40"))
	default_model = os.getenv("HEALTH_ACTIVE_MODEL", "IMDN")

	try:
		sample = _read_tegrastats_sample()
		if not sample:
			return {
				"source": "fallback",
				"gpu_percent": None,
				"vram_used_gb": None,
				"vram_total_gb": None,
				"temp_c": None,
				"power_w": None,
				"max_power_w": default_power_budget,
				"active_model": default_model,
			}

		metrics = _parse_tegrastats_metrics(sample)
		parsed_count = sum(
			1
			for value in [
				metrics.get("gpu_percent"),
				metrics.get("vram_used_gb"),
				metrics.get("vram_total_gb"),
				metrics.get("temp_c"),
				metrics.get("power_w"),
			]
			if value is not None
		)
		metrics.update(
			{
				"source": "tegrastats",
				"parsed_metrics": parsed_count,
				"sample_excerpt": sample[:160],
				"max_power_w": default_power_budget,
				"active_model": default_model,
			}
		)
		return metrics
	except Exception as exc:
		return {
			"source": "fallback",
			"gpu_percent": None,
			"vram_used_gb": None,
			"vram_total_gb": None,
			"temp_c": None,
			"power_w": None,
			"max_power_w": default_power_budget,
			"active_model": default_model,
			"collector_error": str(exc)[:160],
		}


app = FastAPI(title="Jetson Health API", version="1.0.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=_parse_origins(os.getenv("HEALTH_CORS_ORIGINS", "*")),
	allow_credentials=True,
	allow_methods=["GET", "OPTIONS"],
	allow_headers=["*"],
)


@app.get("/health")
def health(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> dict[str, str | int]:
	_require_api_key(x_api_key)
	return {
		"status": "ok",
		"service": "jetson-health",
		"host": socket.gethostname(),
		"uptime_seconds": int(time() - STARTED_AT),
	}


@app.get("/control-panel/metrics")
def control_panel_metrics(
	x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, float | int | str | None]:
	_require_api_key(x_api_key)
	metrics = _collect_control_panel_metrics()
	metrics.update(
		{
			"status": "ok",
			"service": "jetson-health",
			"host": socket.gethostname(),
			"uptime_seconds": int(time() - STARTED_AT),
		}
	)
	return metrics


if __name__ == "__main__":
	import uvicorn

	host = os.getenv("HEALTH_HOST", "0.0.0.0")
	port = int(os.getenv("HEALTH_PORT", "9000"))
	uvicorn.run("backend-demo:app", host=host, port=port, reload=True)
