"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateLeadNotes } from "../../actions";

export function LeadNotes({ leadId, notes }: { leadId: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const [pending, startTransition] = useTransition();
  const dirty = value !== notes;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          aria-label="Notes sur ce prospect"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={6}
          placeholder="Ce que tu sais et qui ne rentre nulle part ailleurs…"
        />
        {dirty && (
          <ActionButton
            size="sm"
            disabled={pending}
            tooltip="Enregistre tes notes sur ce prospect. Elles ne sont pas transmises au modèle."
            onClick={() =>
              startTransition(async () => {
                await updateLeadNotes(leadId, value);
                toast.success("Notes enregistrées");
              })
            }
          >
            Enregistrer
          </ActionButton>
        )}
      </CardContent>
    </Card>
  );
}
