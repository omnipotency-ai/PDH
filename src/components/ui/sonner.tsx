import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/components/theme-provider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const resolvedTheme: ToasterProps["theme"] =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      toastOptions={{
        style: {
          fontSize: "0.9375rem",
          padding: "14px 16px",
        },
        actionButtonStyle: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "#fff",
          fontWeight: "600",
          fontSize: "0.8125rem",
          padding: "6px 14px",
          borderRadius: "6px",
        },
        cancelButtonStyle: {
          backgroundColor: "transparent",
          border: "1px solid rgba(0, 0, 0, 0.25)",
          color: "inherit",
          fontWeight: "500",
          fontSize: "0.8125rem",
          padding: "6px 14px",
          borderRadius: "6px",
        },
      }}
      style={
        {
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
