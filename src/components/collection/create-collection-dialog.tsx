"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import type { Collection } from "@/types/domain";

export function CreateCollectionDialog() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const created = await apiFetch<Collection>("/api/collections", {
        method: "POST",
        json: {
          name: String(form.get("name")),
          description: String(form.get("description") ?? ""),
          is_public: isPublic,
        },
      });
      toast.success(t.collections.created);
      setOpen(false);
      router.push(`/teacher/collections/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> {t.collections.create}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t.common.close}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.collections.createTitle}</DialogTitle>
            <DialogDescription>{t.collections.emptyHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="c-name">{t.collections.name}</Label>
            <Input
              id="c-name"
              name="name"
              required
              maxLength={150}
              placeholder={t.collections.namePlaceholder}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-desc">
              {t.collections.description}{" "}
              <span className="text-muted-foreground font-normal">({t.common.optional})</span>
            </Label>
            <Textarea
              id="c-desc"
              name="description"
              maxLength={2000}
              placeholder={t.collections.descriptionPlaceholder}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
            <div>
              <Label htmlFor="c-public">{t.collections.isPublic}</Label>
              <p className="text-muted-foreground mt-1 text-xs">
                {isPublic ? t.collections.publicHint : t.collections.privateHint}
              </p>
            </div>
            <Switch id="c-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} {t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
