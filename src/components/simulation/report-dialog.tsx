"use client";

import { Flag, Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";

export function ReportDialog({
  simulationId,
  defaultReason = "broken_link",
  trigger,
  variant = "ghost",
  size = "sm",
}: {
  simulationId: string;
  defaultReason?: ReportReason;
  trigger?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(defaultReason);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        json: { simulation_id: simulationId, reason, message },
      });
      toast.success(t.report.success);
      setOpen(false);
      setMessage("");
    } catch (err) {
      toast.error(errorMessage(err, t) || t.report.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size={size}>
            <Flag /> {t.detail.reportIssue}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={t.common.close}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.report.title}</DialogTitle>
            <DialogDescription>{t.report.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="report-reason">{t.report.reason}</Label>
            <NativeSelect
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t.report.reasons[r]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-message">
              {t.report.message}{" "}
              <span className="text-muted-foreground font-normal">({t.common.optional})</span>
            </Label>
            <Textarea
              id="report-message"
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.report.messagePlaceholder}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={sending}>
              {sending && <Loader2 className="animate-spin" />} {t.report.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
