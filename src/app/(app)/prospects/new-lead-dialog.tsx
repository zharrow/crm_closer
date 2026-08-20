"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "@/components/animate-ui/icons/plus";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createLead } from "../actions";

const FIELDS = [
  { name: "companyName", label: "Entreprise", required: true, placeholder: "Boulangerie Martin" },
  { name: "contactName", label: "Contact", placeholder: "Sophie Martin" },
  { name: "email", label: "Email", type: "email", placeholder: "contact@exemple.fr" },
  { name: "phone", label: "Téléphone", placeholder: "05 61 00 00 00" },
  { name: "website", label: "Site web", placeholder: "exemple.fr" },
  { name: "city", label: "Ville", placeholder: "Toulouse" },
  { name: "linkedinUrl", label: "LinkedIn", placeholder: "linkedin.com/in/…" },
] as const;

export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createLead({
        companyName: String(data.get("companyName") ?? ""),
        contactName: String(data.get("contactName") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        website: String(data.get("website") ?? ""),
        city: String(data.get("city") ?? ""),
        linkedinUrl: String(data.get("linkedinUrl") ?? ""),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Prospect créé");
      if (result.id) router.push(`/prospects/${result.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Le déclencheur reste un Button : `asChild` exige un enfant unique,
          et ActionButton rend un fragment. L'infobulle enveloppe donc le
          déclencheur au lieu de passer par ActionButton. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={16} />
              Ajouter
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Ouvre le formulaire de création d&apos;un prospect à la main.
        </TooltipContent>
      </Tooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
          <DialogDescription>
            Seul le nom est obligatoire. Le site permet de détecter les signaux.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.name} className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type={"type" in field ? field.type : "text"}
                  required={"required" in field ? field.required : false}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <DialogFooter className="mt-2">
            <ActionButton
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              tooltip="Ferme le formulaire sans rien créer."
            >
              Annuler
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={pending}
              tooltip="Crée le prospect avec les champs saisis. Il n'est pas encore enrichi ni inscrit en séquence."
            >
              {pending ? "Création…" : "Créer"}
            </ActionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
