import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dashboardTabsForRole } from "../../utils/dashboardAccess";
import AdminCarsDashboard from "./CarsDashboard";
import GaOperationsDashboard from "./GaOperationsDashboard";

function DashboardTabs({ activeTab, tabs, onChange }) {
  if (tabs.length < 2) return null;
  return (
    <div className="mt-5 flex border-b border-[#DCE2DE]" role="tablist" aria-label="Pilih dashboard operasional">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => onChange(tab)}
          className={`border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            activeTab === tab
              ? "border-[#168454] text-[#168454]"
              : "border-transparent text-[#68726B] hover:text-[#354139]"
          }`}
        >
          {tab === "meeting" ? "Ruang Rapat" : "Kendaraan"}
        </button>
      ))}
    </div>
  );
}

export default function OperationsDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const availableTabs = dashboardTabsForRole(user?.role);
  const requestedTab = searchParams.get("tab");
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : availableTabs[0];

  useEffect(() => {
    if (activeTab && requestedTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  const tabs = (
    <DashboardTabs
      activeTab={activeTab}
      tabs={availableTabs}
      onChange={(tab) => setSearchParams({ tab })}
    />
  );

  if (activeTab === "vehicle") return <AdminCarsDashboard dashboardTabs={tabs} />;
  return <GaOperationsDashboard dashboardTabs={tabs} />;
}
