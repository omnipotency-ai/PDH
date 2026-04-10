import { Database, HeartPulse, Palette, Sliders, Upload } from "lucide-react";
import { AppDataForm } from "@/components/settings/AppDataForm";
import { HealthForm } from "@/components/settings/HealthForm";
import { PreferencesForm } from "@/components/settings/PreferencesForm";
import { SettingsTile } from "@/components/settings/SettingsTile";
import { TrackingForm } from "@/components/settings/TrackingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useHabits, useHealthProfile, useSleepGoal } from "@/hooks/useProfile";

export default function SettingsPage() {
  const { healthProfile } = useHealthProfile();
  const { sleepGoal } = useSleepGoal();
  const { habits } = useHabits();

  // Summary values for mobile tiles
  const computedBmi = (() => {
    if (!healthProfile) return null;
    const weightKg = healthProfile.currentWeight ?? healthProfile.startingWeight;
    if (!weightKg || !healthProfile.height) return null;
    const heightM = healthProfile.height / 100;
    return (weightKg / (heightM * heightM)).toFixed(1);
  })();
  const healthSummary = [
    healthProfile?.ageYears != null ? `Age ${healthProfile.ageYears}` : "",
    healthProfile?.gender ? healthProfile.gender.replaceAll("_", " ") : "",
    computedBmi ? `BMI ${computedBmi}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const trackingSummary = `${habits.length} habits · ${sleepGoal.targetHours}h sleep`;
  const appdataSummary = "Units, export, reset";

  return (
    <div className="stagger-reveal mx-auto max-w-[1680px] px-4 py-6 pb-24">
      <div className="space-y-5">
        {/* ── Desktop (lg+) ── */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          <Card className="settings-panel settings-panel-appdata">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base text-[var(--text)]">
                <span className="settings-card-media settings-card-media-appdata">
                  <img src="/app-data-img.png" alt="App and data section" />
                </span>
                <span className="leading-tight">App & Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AppDataForm />
            </CardContent>
          </Card>

          <Card className="settings-panel settings-panel-health">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base text-[var(--text)]">
                <span className="settings-card-media settings-card-media-health">
                  <img src="/health-surgery-img.png" alt="Health profile and history section" />
                </span>
                <span className="leading-tight">Health Profile & History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HealthForm />
            </CardContent>
          </Card>

          <Card className="settings-panel settings-panel-preferences">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base text-[var(--text)]">
                <span className="settings-card-media settings-card-media-preferences">
                  <Palette className="h-full w-full p-1.5 text-[var(--section-preferences)]" />
                </span>
                <span className="leading-tight">Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PreferencesForm />
            </CardContent>
          </Card>

          <Card className="settings-panel settings-panel-tracking">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base text-[var(--text)]">
                <span className="settings-card-media settings-card-media-tracking">
                  <img src="/tracking-preferences-img.png" alt="Tracking and habits section" />
                </span>
                <span className="leading-tight">Tracking</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrackingForm />
            </CardContent>
          </Card>
        </div>

        {/* ── Mobile Tiles + Drawers (< lg) ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <SettingsTile
                color="appdata"
                icon={Upload}
                title="App & Data"
                summary={appdataSummary}
              />
            </DrawerTrigger>
            <DrawerContent className="settings-drawer">
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-[var(--section-appdata)]" />
                  App & Data
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  App and data management settings
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <AppDataForm />
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer>
            <DrawerTrigger asChild>
              <SettingsTile
                color="health"
                icon={HeartPulse}
                title="Health Profile & History"
                summary={healthSummary}
              />
            </DrawerTrigger>
            <DrawerContent className="settings-drawer">
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-[var(--section-health)]" />
                  Health Profile & History
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  Health profile and medical history settings
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <HealthForm />
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer>
            <DrawerTrigger asChild>
              <SettingsTile
                color="preferences"
                icon={Palette}
                title="Preferences"
                summary="Dr. Poo name, schedule, style"
              />
            </DrawerTrigger>
            <DrawerContent className="settings-drawer">
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[var(--section-preferences)]" />
                  Preferences
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  Dr. Poo name, schedule, and style settings
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <PreferencesForm />
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer>
            <DrawerTrigger asChild>
              <SettingsTile
                color="tracking"
                icon={Sliders}
                title="Tracking"
                summary={trackingSummary}
              />
            </DrawerTrigger>
            <DrawerContent className="settings-drawer">
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[var(--section-tracking)]" />
                  Tracking
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  Tracking configuration settings
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <TrackingForm />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
}
