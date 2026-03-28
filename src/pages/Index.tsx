import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { OverviewView } from "@/components/views/OverviewView";
import { RealtimeView } from "@/components/views/RealtimeView";
import { OfflineView } from "@/components/views/OfflineView";
import { ImageView } from "@/components/views/ImageView";
import { ControlPanelView } from "@/components/views/ControlPanelView";
import { ModelArenaView } from "@/components/views/ModelArenaView";

const views = [OverviewView, RealtimeView, OfflineView, ImageView, ControlPanelView, ModelArenaView];

const Index = () => {
  const [activeMode, setActiveMode] = useState(0);
  const ActiveView = views[activeMode];

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar activeMode={activeMode} onModeChange={setActiveMode} />
      <main className="flex-1 overflow-y-auto">
        <ActiveView />
      </main>
    </div>
  );
};

export default Index;
