"use client";

import { Activity, Clock, FolderOpen, Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n/client";

export type TeacherTab = "collections" | "favorites" | "recent" | "activity";

export function DashboardTabs({
  initial,
  panels,
}: {
  initial: TeacherTab;
  panels: Record<TeacherTab, ReactNode>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const tabs: { value: TeacherTab; label: string; icon: typeof Heart }[] = [
    { value: "collections", label: t.teacher.tabs.collections, icon: FolderOpen },
    { value: "favorites", label: t.teacher.tabs.favorites, icon: Heart },
    { value: "recent", label: t.teacher.tabs.recent, icon: Clock },
    { value: "activity", label: t.teacher.tabs.activity, icon: Activity },
  ];
  return (
    <Tabs
      defaultValue={initial}
      onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      className="w-full"
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            <tab.icon aria-hidden /> {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {panels[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
