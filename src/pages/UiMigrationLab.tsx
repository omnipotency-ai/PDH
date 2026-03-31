import { ChevronRight, FlaskConical, Menu, PanelRightClose, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const longList = [
  "Bowel movement",
  "Hydration",
  "Meals",
  "Symptoms",
  "Sleep",
  "Movement",
  "Medication",
  "Mood",
  "Cycle",
  "Notes",
  "Weight",
  "Energy",
];

export default function UiMigrationLab() {
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [menuChecks, setMenuChecks] = useState({ alerts: true, notes: false });
  const [menuRadio, setMenuRadio] = useState("compact");
  const [togglePressed, setTogglePressed] = useState(false);
  const [toggleGroupValue, setToggleGroupValue] = useState<string[]>(["weight"]);
  const [responsiveShellOpen, setResponsiveShellOpen] = useState(false);
  const [anchoredPopoverOpen, setAnchoredPopoverOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <div className="rounded-3xl border border-white/10 bg-[var(--surface-1)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-faint)]">
              Manual Verification
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-[var(--text)]">
              Base UI Migration Lab
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              This page exercises the migrated primitives in one place. Open the menus, drawers,
              sheets, tooltips, tabs, and toggles here and compare the behavior against what you
              expect in the live screens.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Base UI wrappers</Badge>
            <Badge variant="outline">Overlay + motion pass</Badge>
            <Button render={<a href="/settings">Back to Settings</a>}>Back to Settings</Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-teal-400/30 bg-teal-400/12 px-3 py-1 text-xs font-semibold text-teal-200 dark:text-teal-200">
            Teal primary
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1 text-xs font-semibold text-sky-200 dark:text-sky-200">
            Sky secondary
          </span>
          <span className="rounded-full border border-orange-400/30 bg-orange-400/12 px-3 py-1 text-xs font-semibold text-orange-200 dark:text-orange-200">
            Orange accent
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Buttons, labels, toggles</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4">
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="xs" variant="outline">
                  XS
                </Button>
                <Button size="sm" variant="outline">
                  SM
                </Button>
                <Button size="default" variant="outline">
                  MD
                </Button>
                <Button size="lg" variant="outline">
                  LG
                </Button>
                <Button size="xl" variant="secondary">
                  XL
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="ghost">Ghost</Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ui-lab-input">Labeled input</Label>
                <Input id="ui-lab-input" placeholder="Field + Label wiring" />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="ui-lab-checkbox"
                  checked={checkboxChecked}
                  onCheckedChange={setCheckboxChecked}
                />
                <Label htmlFor="ui-lab-checkbox">
                  Checkbox state: {checkboxChecked ? "on" : "off"}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} />
                <span className="text-sm text-[var(--text)]">
                  Switch state: {switchChecked ? "enabled" : "disabled"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Toggle
                  pressed={togglePressed}
                  onPressedChange={setTogglePressed}
                  variant="outline"
                >
                  <Sparkles className="size-4" />
                  Toggle
                </Toggle>
                <ToggleGroup
                  type="multiple"
                  value={toggleGroupValue}
                  onValueChange={(value) =>
                    setToggleGroupValue(Array.isArray(value) ? value : [value])
                  }
                  variant="outline"
                >
                  <ToggleGroupItem value="weight">Weight</ToggleGroupItem>
                  <ToggleGroupItem value="food">Food</ToggleGroupItem>
                  <ToggleGroupItem value="sleep">Sleep</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Toggle group value: {toggleGroupValue.length ? toggleGroupValue.join(", ") : "none"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Overlays and navigation</h2>
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Tooltip trigger</Button>
                </TooltipTrigger>
                <TooltipContent>Tooltip motion, positioning, and close behavior.</TooltipContent>
              </Tooltip>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Trigger popover</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <PopoverHeader>
                    <PopoverTitle>Triggered popover</PopoverTitle>
                    <PopoverDescription>
                      Checks trigger composition and focus handoff.
                    </PopoverDescription>
                  </PopoverHeader>
                </PopoverContent>
              </Popover>

              <Popover open={anchoredPopoverOpen} onOpenChange={setAnchoredPopoverOpen}>
                <PopoverAnchor asChild>
                  <div className="rounded-2xl border border-dashed border-white/15 px-3 py-2 text-sm text-[var(--text-muted)]">
                    Anchored card target
                  </div>
                </PopoverAnchor>
                <Button
                  variant="secondary"
                  onClick={() => setAnchoredPopoverOpen((current) => !current)}
                >
                  Toggle anchored popover
                </Button>
                <PopoverContent sideOffset={10} className="w-72">
                  <PopoverHeader>
                    <PopoverTitle>Anchored popover</PopoverTitle>
                    <PopoverDescription>
                      This verifies the custom Base UI anchor bridge used by the quick-capture
                      tiles.
                    </PopoverDescription>
                  </PopoverHeader>
                </PopoverContent>
              </Popover>
            </div>

            <div className="rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4">
              <NavigationMenu viewport={false}>
                <NavigationMenuList className="justify-start">
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Daily log</NavigationMenuTrigger>
                    <NavigationMenuContent className="w-[320px]">
                      <div className="grid gap-2">
                        <NavigationMenuLink render={<a href="/settings">Settings overview</a>}>
                          Settings overview
                        </NavigationMenuLink>
                        <NavigationMenuLink render={<a href="/patterns">Pattern analysis</a>}>
                          Pattern analysis
                        </NavigationMenuLink>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink render={<a href="/archive">Archive</a>} active>
                      History
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            <div className="flex flex-wrap gap-3 rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Menu className="size-4" />
                    Dropdown menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Display mode</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={menuRadio} onValueChange={setMenuRadio}>
                      <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Extras</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={menuChecks.alerts}
                      onCheckedChange={(checked) =>
                        setMenuChecks((current) => ({ ...current, alerts: checked }))
                      }
                    >
                      Alerts
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={menuChecks.notes}
                      onCheckedChange={(checked) =>
                        setMenuChecks((current) => ({ ...current, notes: checked }))
                      }
                    >
                      Notes
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger inset>Advanced</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem>Nested action</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive">Danger action</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    <PanelRightClose className="size-4" />
                    Open sheet
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="gap-0 p-0">
                  <SheetHeader className="border-b">
                    <SheetTitle>Sheet demo</SheetTitle>
                    <SheetDescription>Side panel animation and close button.</SheetDescription>
                  </SheetHeader>
                  <div className="p-4 text-sm text-[var(--text-muted)]">
                    This is the Base UI dialog-backed sheet wrapper.
                  </div>
                </SheetContent>
              </Sheet>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline">
                    <ChevronRight className="size-4" />
                    Open drawer
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Drawer demo</DrawerTitle>
                    <DrawerDescription>
                      Checks the mobile-style drawer wrapper after removing Vaul.
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerFooter>
                    <Button>Primary action</Button>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>

              <Button variant="secondary" onClick={() => setResponsiveShellOpen(true)}>
                Responsive shell
              </Button>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Disclosure + tabs</h2>
          <div className="mt-4 space-y-4">
            <Collapsible
              open={collapsibleOpen}
              onOpenChange={setCollapsibleOpen}
              className="overflow-hidden rounded-2xl border border-white/8 bg-[var(--surface-0)]"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold text-[var(--text)] transition-colors hover:bg-white/4 hover:text-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/35 focus:ring-inset"
                >
                  <span className="flex items-center gap-2">
                    <FlaskConical className="size-4" />
                    Flexible section
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {collapsibleOpen ? "Collapse" : "Expand"}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-white/8 px-4 py-4 text-sm text-[var(--text-muted)]">
                The trigger stays visually part of the same card, and the panel now eases in below
                it instead of feeling detached.
              </CollapsibleContent>
            </Collapsible>

            <Accordion defaultValue={["summary"]} multiple className="space-y-3">
              <AccordionItem
                value="summary"
                className="overflow-hidden rounded-2xl border border-white/8 bg-[var(--surface-0)] px-4"
              >
                <AccordionTrigger>Symptom summary</AccordionTrigger>
                <AccordionContent className="text-[var(--text-muted)]">
                  Confirms Base UI accordion panel open-state selectors and icon rotation.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="details"
                className="overflow-hidden rounded-2xl border border-white/8 bg-[var(--surface-0)] px-4"
              >
                <AccordionTrigger>Nutrition details</AccordionTrigger>
                <AccordionContent className="text-[var(--text-muted)]">
                  Open and close this item as well to verify multiple-item behavior.
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Tabs defaultValue="one">
              <TabsList className="w-full">
                <TabsTrigger value="one">Daily view</TabsTrigger>
                <TabsTrigger value="two">Patterns view</TabsTrigger>
              </TabsList>
              <TabsContent
                value="one"
                className="rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4 text-sm text-[var(--text-muted)]"
              >
                Tabs now read as a section switcher rather than a pill group, and keyboard focus no
                longer draws over the active border.
              </TabsContent>
              <TabsContent
                value="two"
                className="rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4 text-sm text-[var(--text-muted)]"
              >
                Switch tabs with mouse and keyboard to validate focus roving and active styling.
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[var(--surface-1)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Scroll area + separators</h2>
          <div className="mt-4 rounded-2xl border border-white/8 bg-[var(--surface-0)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text)]">Scrollable list</span>
              <Badge variant="outline">12 rows</Badge>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-56 pr-2">
              <div className="space-y-2">
                {longList.map((item, index) => (
                  <div
                    key={item}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
                      index % 2 === 0
                        ? "border-white/8 bg-[var(--surface-1)]"
                        : "border-sky-400/15 bg-sky-400/6",
                    )}
                  >
                    <span className="text-[var(--text)]">{item}</span>
                    <span className="text-xs text-[var(--text-faint)]">ready</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </section>
      </div>

      <ResponsiveShell
        open={responsiveShellOpen}
        onOpenChange={setResponsiveShellOpen}
        title="Responsive shell demo"
        description="Resize the window to verify the mobile drawer, tablet dialog, and desktop sheet variants."
      >
        <div className="space-y-4 p-4 text-sm text-[var(--text-muted)]">
          <p>
            This wrapper now routes through the Base UI drawer and dialog primitives instead of the
            old Radix/Vaul mix.
          </p>
          <p>
            Check the close button, outside-click behavior, and focus restoration on each
            breakpoint.
          </p>
        </div>
      </ResponsiveShell>
    </div>
  );
}
