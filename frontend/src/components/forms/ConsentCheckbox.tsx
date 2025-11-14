"use client";
import Checkbox, { CheckboxProps } from "./Checkbox";

export interface ConsentCheckboxProps extends Omit<CheckboxProps, "label"> {
  variant?: "gdpr" | "terms" | "ticket";
}

export default function ConsentCheckbox({
  variant = "ticket",
  ...props
}: ConsentCheckboxProps) {
  const labels = {
    gdpr: "Jeg godtar personvernerklæringen og vilkår for behandling av mine personopplysninger",
    terms: "Jeg godtar vilkårene for bruk av Tog Refusjon",
    ticket:
      "Jeg samtykker til at Tog Refusjon behandler min billett og personopplysninger for å kreve refusjon på mine vegne",
  };

  const helperTexts = {
    gdpr: "Dine data lagres kryptert i henhold til GDPR. Se vår personvernerklæring for detaljer.",
    terms: "Les vilkårene nøye. Du kan når som helst trekke tilbake samtykket.",
    ticket:
      "PII lagres kryptert. Vi sletter automatisk data etter 12 måneder.",
  };

  return (
    <Checkbox
      label={labels[variant]}
      helperText={helperTexts[variant]}
      required
      {...props}
    />
  );
}
