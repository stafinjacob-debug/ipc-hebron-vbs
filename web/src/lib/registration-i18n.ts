import type { FormFieldDef, FormSectionDef } from "@/lib/registration-form-definition";
import {
  DEFAULT_WAIVER_BODY,
  DEFAULT_WAIVER_BODY_ES,
  DEFAULT_WAIVER_DESCRIPTION,
  DEFAULT_WAIVER_DESCRIPTION_ES,
  DEFAULT_WAIVER_TITLE,
  DEFAULT_WAIVER_TITLE_ES,
  type WaiverDisplayContent,
} from "@/lib/default-waiver-content";

export type RegistrationLocale = "en" | "es";

export const REGISTRATION_LOCALE_STORAGE_KEY = "vbs-registration-locale";

export function normalizeRegistrationLocale(raw: string | null | undefined): RegistrationLocale {
  return raw === "es" ? "es" : "en";
}

const messages = {
  en: {
    languageEnglish: "English",
    languageSpanish: "Español",
    languageSwitcherLabel: "Form language",
    staffSignIn: "Staff sign in",
    optional: "(optional)",
    chooseOption: "Choose…",
    stepOf: "Step {current} of {total}",
    back: "Back",
    continue: "Continue",
    submit: "Submit",
    submitRegistration: "Submit registration",
    submitPayCard: "Submit & pay with card",
    payWithCard: "Pay with card",
    submitting: "Submitting…",
    review: "Review",
    privacy: "Privacy",
    waiver: "Waiver",
    yourInformation: "Your information",
    contactInformation: "Contact information",
    participants: "Participants",
    additionalInformation: "Additional information",
    reviewSubmit: "Review & submit",
    reviewSubmitDesc: "Take a quick look before sending.",
    digitalWaiver: "Digital waiver",
    remove: "Remove",
    addAnother: "Add another {label}",
    questions: "Questions?",
    consented: "Consented",
    notConsented: "Not consented",
    smsUpdates: "SMS updates",
    payment: "Payment",
    cardPayment: "Card payment",
    totalDue: "Total due",
    programFee: "Program fee",
    child: "child",
    children: "children",
    allSet: "You're all set!",
    payLaterHeading: "Pay later — what to know",
    payLaterEmailNote: "Payment details are also in the confirmation email we sent you.",
    registrationClosed: "Online registration isn't open right now",
    lookUpRegistration: "Look up your registration",
    alreadyRegistered: "Already registered? Look up or edit",
    welcomeFallback: "Please complete this form to register for {eventName}.",
    guardianContactDesc: "We'll use this for event updates and emergencies.",
    participantsDesc: "Add every {label} who will participate on this form.",
    ageGate:
      "Each {label} must be between {min} and {max} years old (whole years) as of {asOf}.",
    confirmAccurate:
      "I confirm the information is accurate to the best of my knowledge, and I agree to the church using it for {eventName}.",
    smsConsent:
      "I agree to receive SMS text messages on my provided phone number for {eventName} updates and announcements.",
    paymentNotCompleted: "Payment was not completed",
    paymentNotCompletedDetail:
      "Your registration details are still here — review the payment step and submit again when you're ready. If you already paid, wait a moment for confirmation or contact the church office with your reference code.",
    needHelpPrivacy: "Need help? Check the privacy step.",
    needHelpEmail: "Need help?",
    needHelpOrganizer: "Need help? Contact the event organizer.",
    validEmail: "Enter a valid email address.",
    validEmailRequired: "Please enter a valid email address.",
    phoneRequired: "Phone is required.",
    phoneSmsRequired: "Please provide a phone number to receive SMS updates.",
    fieldRequired: "{label} is required.",
    participantFieldRequired: "{participant} {index}: {label} is required.",
    confirmAccurateRequired: "Please confirm the information is accurate to continue.",
    choosePayment: "Choose how you would like to pay.",
    formNotLoaded: "Form not loaded.",
    waiverLoading: "Waiver forms are still loading — try again in a moment.",
    waiverComplete: "{label}: complete the waiver section.",
    waiverSignerName: "{label}: enter the signer name on the waiver.",
    waiverSignedAt: "{label}: choose the waiver signature date and time.",
    waiverSignature: "{label}: enter the signer name to generate the electronic signature.",
    waiverAccept: "{label}: accept the waiver terms to continue.",
    waiverFieldRequired: '{label}: fill in "{field}" on the waiver.',
    payCardNow: "Pay with card now",
    payCardNowDetail: "Continue to secure Stripe checkout after you submit.",
    payLater: "Pay later",
    payLaterDetailVbs: "Register now; pay by card online before VBS, or pay on site on Day 1.",
    payLaterDetailEvent: "Register now; pay by card online before {eventName}, or pay on site on the first day.",
    waiverSignedFor: "Digital waiver signed for {count} {label} ({eventName}).",
    dbUnavailable:
      "Registration is temporarily unavailable because the database connection timed out. Please try again in a minute.",
    allergyNo: "No",
    allergyYes: "Yes",
    allergySelectAll: "Select all that apply:",
    allergyOther: "Other",
    allergyOtherPlaceholder: "Add any other allergy or medical notes",
    signaturePreview:
      "Your signature appears here automatically when you enter the signer name above.",
    signerName: "Signer name",
    signedAt: "Signed at",
    signerNamePlaceholder: "Parent/guardian full name",
    electronicSignature: "Electronic signature",
    signatureFromName: "Generated from the signer name above — no drawing required.",
    waiverFor: "Waiver for",
    waiverNofM: "Waiver {current} of {total}",
    preparingWaiver: "Preparing waiver…",
    waiverAppliesTo: "Everything in this card (questions, signature, and agreement) applies only to {name}.",
    waiverAcceptTerms:
      "I have read this waiver for {name} and agree to its terms. I understand this electronic signature (from the typed name above) will be stored with this registration.",
    waiverMultiChild:
      "You're registering {count} {label}s — use a separate card for each. The name on each card is who this waiver is for.",
    waiverSingleChild: "Please read and sign below. You'll review everything on the next step.",
    waiverEachCard: "Each card matches one child from the previous step — sign every card before continuing.",
    waiverParticipantFromStep: "The participant name below is taken from the child you entered on the previous step.",
    processingFeeEst: "Card processing (est.)",
    stripeAfterSubmit:
      "After you submit, you can continue to a secure Stripe checkout page to pay by card. Estimated processing fee uses typical US card pricing (2.9% + $0.30); actual Stripe fees may vary slightly.",
    coverProcessingFee:
      "Cover the estimated card processing fee ({amount}) so the program nets closer to the full registration amount after card fees.",
    processingFeeIncluded: "This form includes the estimated card processing fee on every payment.",
    teamReviewNote:
      "Thank you — we have received your registration. Someone from our team will review your details and confirm your enrollment. If anything else is needed, we will reach out using the contact information you provided.",
  },
  es: {
    languageEnglish: "English",
    languageSpanish: "Español",
    languageSwitcherLabel: "Idioma del formulario",
    staffSignIn: "Acceso del personal",
    optional: "(opcional)",
    chooseOption: "Elija…",
    stepOf: "Paso {current} de {total}",
    back: "Atrás",
    continue: "Continuar",
    submit: "Enviar",
    submitRegistration: "Enviar registro",
    submitPayCard: "Enviar y pagar con tarjeta",
    payWithCard: "Pagar con tarjeta",
    submitting: "Enviando…",
    review: "Revisar",
    privacy: "Privacidad",
    waiver: "Renuncia",
    yourInformation: "Su información",
    contactInformation: "Información de contacto",
    participants: "Participantes",
    additionalInformation: "Información adicional",
    reviewSubmit: "Revisar y enviar",
    reviewSubmitDesc: "Revise todo antes de enviar.",
    digitalWaiver: "Renuncia digital",
    remove: "Quitar",
    addAnother: "Agregar otro {label}",
    questions: "¿Preguntas?",
    consented: "Aceptó",
    notConsented: "No aceptó",
    smsUpdates: "Mensajes SMS",
    payment: "Pago",
    cardPayment: "Pago con tarjeta",
    totalDue: "Total a pagar",
    programFee: "Tarifa del programa",
    child: "niño",
    children: "niños",
    allSet: "¡Listo!",
    payLaterHeading: "Pagar después — qué debe saber",
    payLaterEmailNote: "Los detalles de pago también están en el correo de confirmación que le enviamos.",
    registrationClosed: "El registro en línea no está abierto en este momento",
    lookUpRegistration: "Buscar su registro",
    alreadyRegistered: "¿Ya se registró? Buscar o editar",
    welcomeFallback: "Complete este formulario para registrarse en {eventName}.",
    guardianContactDesc: "Usaremos esto para avisos del evento y emergencias.",
    participantsDesc: "Agregue a cada {label} que participará en este formulario.",
    ageGate:
      "Cada {label} debe tener entre {min} y {max} años (años completos) al {asOf}.",
    confirmAccurate:
      "Confirmo que la información es correcta según mi conocimiento y acepto que la iglesia la use para {eventName}.",
    smsConsent:
      "Acepto recibir mensajes de texto SMS en mi número de teléfono para avisos y anuncios de {eventName}.",
    paymentNotCompleted: "El pago no se completó",
    paymentNotCompletedDetail:
      "Sus datos de registro siguen aquí — revise el paso de pago y envíe de nuevo cuando esté listo. Si ya pagó, espere un momento para la confirmación o contacte la oficina de la iglesia con su código de referencia.",
    needHelpPrivacy: "¿Necesita ayuda? Revise el paso de privacidad.",
    needHelpEmail: "¿Necesita ayuda?",
    needHelpOrganizer: "¿Necesita ayuda? Contacte al organizador del evento.",
    validEmail: "Ingrese un correo electrónico válido.",
    validEmailRequired: "Ingrese un correo electrónico válido.",
    phoneRequired: "El teléfono es obligatorio.",
    phoneSmsRequired: "Proporcione un número de teléfono para recibir avisos por SMS.",
    fieldRequired: "{label} es obligatorio.",
    participantFieldRequired: "{participant} {index}: {label} es obligatorio.",
    confirmAccurateRequired: "Confirme que la información es correcta para continuar.",
    choosePayment: "Elija cómo desea pagar.",
    formNotLoaded: "El formulario no se cargó.",
    waiverLoading: "Las renuncias aún se están cargando — intente de nuevo en un momento.",
    waiverComplete: "{label}: complete la sección de renuncia.",
    waiverSignerName: "{label}: ingrese el nombre del firmante en la renuncia.",
    waiverSignedAt: "{label}: elija la fecha y hora de la firma.",
    waiverSignature: "{label}: ingrese el nombre del firmante para generar la firma electrónica.",
    waiverAccept: "{label}: acepte los términos de la renuncia para continuar.",
    waiverFieldRequired: '{label}: complete "{field}" en la renuncia.',
    payCardNow: "Pagar con tarjeta ahora",
    payCardNowDetail: "Continúe al pago seguro de Stripe después de enviar.",
    payLater: "Pagar después",
    payLaterDetailVbs: "Regístrese ahora; pague en línea antes del VBS o en el sitio el día 1.",
    payLaterDetailEvent:
      "Regístrese ahora; pague en línea antes de {eventName} o en el sitio el primer día.",
    waiverSignedFor: "Renuncia digital firmada para {count} {label} ({eventName}).",
    dbUnavailable:
      "El registro no está disponible temporalmente porque la conexión a la base de datos expiró. Intente de nuevo en un minuto.",
    allergyNo: "No",
    allergyYes: "Sí",
    allergySelectAll: "Seleccione todas las que correspondan:",
    allergyOther: "Otro",
    allergyOtherPlaceholder: "Agregue otras alergias o notas médicas",
    signaturePreview:
      "Su firma aparecerá aquí automáticamente cuando ingrese el nombre del firmante arriba.",
    signerName: "Nombre del firmante",
    signedAt: "Firmado el",
    signerNamePlaceholder: "Nombre completo del padre/madre o tutor",
    electronicSignature: "Firma electrónica",
    signatureFromName: "Generada del nombre del firmante — no necesita dibujar.",
    waiverFor: "Renuncia para",
    waiverNofM: "Renuncia {current} de {total}",
    preparingWaiver: "Preparando renuncia…",
    waiverAppliesTo:
      "Todo en esta tarjeta (preguntas, firma y acuerdo) aplica solo a {name}.",
    waiverAcceptTerms:
      "He leído esta renuncia para {name} y acepto sus términos. Entiendo que esta firma electrónica (del nombre escrito arriba) se guardará con este registro.",
    waiverMultiChild:
      "Está registrando {count} {label}s — use una tarjeta separada para cada uno. El nombre en cada tarjeta es para quien es esta renuncia.",
    waiverSingleChild: "Lea y firme abajo. Revisará todo en el siguiente paso.",
    waiverEachCard:
      "Cada tarjeta corresponde a un niño del paso anterior — firme cada tarjeta antes de continuar.",
    waiverParticipantFromStep:
      "El nombre del participante abajo proviene del niño que ingresó en el paso anterior.",
    processingFeeEst: "Procesamiento de tarjeta (est.)",
    stripeAfterSubmit:
      "Después de enviar, puede continuar a una página segura de Stripe para pagar con tarjeta. La tarifa estimada usa precios típicos de tarjeta en EE. UU. (2.9% + $0.30); las tarifas reales pueden variar un poco.",
    coverProcessingFee:
      "Cubra la tarifa estimada de procesamiento ({amount}) para que el programa reciba más cerca del monto completo después de las tarifas de tarjeta.",
    processingFeeIncluded: "Este formulario incluye la tarifa estimada de procesamiento en cada pago.",
    teamReviewNote:
      "Gracias — recibimos su registro. Alguien de nuestro equipo revisará sus datos y confirmará su inscripción. Si necesitamos algo más, nos comunicaremos usando la información de contacto que proporcionó.",
  },
} as const;

export type RegistrationMessageKey = keyof (typeof messages)["en"];

export function registrationMessage(
  locale: RegistrationLocale,
  key: RegistrationMessageKey,
  params?: Record<string, string | number>,
): string {
  let text: string = messages[locale][key] ?? messages.en[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

const FIELD_LABELS_ES: Record<string, string> = {
  guardianFirstName: "Nombre",
  guardianLastName: "Apellido",
  guardianEmail: "Correo electrónico",
  guardianPhone: "Teléfono",
  childFirstName: "Nombre del niño",
  childLastName: "Apellido del niño",
  childDateOfBirth: "Fecha de nacimiento",
  allergiesNotes: "Alergias o notas médicas",
};

const FIELD_HELPER_ES: Record<string, string> = {
  guardianEmail: "Solo lo usaremos para comunicación relacionada con el evento.",
  guardianPhone: "Para preguntas del día o emergencias.",
  childDateOfBirth: "Se usa para colocar a su hijo en el grupo de edad correcto.",
  allergiesNotes: "Opcional — ayuda a los maestros a mantener a todos seguros.",
};

const FIELD_PLACEHOLDER_ES: Record<string, string> = {
  guardianFirstName: "p. ej. María",
  guardianLastName: "p. ej. Santos",
  guardianEmail: "nombre@ejemplo.com",
  guardianPhone: "(555) 123-4567",
  allergiesNotes: "Ninguna, o describa alergias / medicamentos",
};

const SECTION_TITLE_ES: Record<string, string> = {
  "Parent / guardian": "Padre / madre / tutor",
  "Child attending VBS": "Niño que asiste al VBS",
  Consent: "Consentimiento",
  "Contact person": "Persona de contacto",
  "Contact information": "Información de contacto",
  "Player information": "Información del jugador",
  Participant: "Participante",
  "Attendee information": "Información del asistente",
};

const SECTION_DESC_ES: Record<string, string> = {
  "We'll use this for event updates and emergencies.":
    "Usaremos esto para avisos del evento y emergencias.",
  "Tell us about each student. Add more children on the next step if needed.":
    "Cuéntenos sobre cada estudiante. Agregue más niños en el siguiente paso si es necesario.",
  "Add each player registering for this event.":
    "Agregue a cada jugador que se registra en este evento.",
  "Add each person attending this event.": "Agregue a cada persona que asiste a este evento.",
};

const STEP_LABEL_ES: Record<string, string> = {
  Review: "Revisar",
  Privacy: "Privacidad",
  Waiver: "Renuncia",
  "Your information": "Su información",
  Participants: "Participantes",
  "Contact information": "Información de contacto",
};

const ALLERGY_PRESET_ES: Record<string, string> = {
  "Peanut / tree nut allergy": "Alergia a maní / frutos secos",
  "Dairy allergy": "Alergia a lácteos",
  "Egg allergy": "Alergia al huevo",
  "Gluten sensitivity / celiac": "Sensibilidad al gluten / celíaco",
  "Medication allergy": "Alergia a medicamentos",
  "Asthma or inhaler needed": "Asma o necesita inhalador",
};

const PARTICIPANT_LABEL_ES: Record<string, string> = {
  Child: "Niño",
  Player: "Jugador",
  Participant: "Participante",
  Attendee: "Asistente",
};

export function translateParticipantLabel(locale: RegistrationLocale, label: string): string {
  if (locale === "en") return label;
  return PARTICIPANT_LABEL_ES[label] ?? label;
}

export function translateStepLabel(locale: RegistrationLocale, label: string): string {
  if (locale === "en") return label;
  return STEP_LABEL_ES[label] ?? label;
}

export function translateSectionTitle(locale: RegistrationLocale, title: string): string {
  if (locale === "en") return title;
  return SECTION_TITLE_ES[title] ?? title;
}

export function translateSectionDescription(
  locale: RegistrationLocale,
  description: string | undefined,
): string | undefined {
  if (!description?.trim() || locale === "en") return description;
  return SECTION_DESC_ES[description.trim()] ?? description;
}

export function translateFieldForDisplay(
  locale: RegistrationLocale,
  field: FormFieldDef,
): FormFieldDef {
  if (locale === "en") return field;
  const label =
    FIELD_LABELS_ES[field.key] ??
    (field.label ? SECTION_TITLE_ES[field.label] : undefined) ??
    field.label;
  const helperText = field.helperText
    ? FIELD_HELPER_ES[field.key] ?? field.helperText
    : FIELD_HELPER_ES[field.key];
  const placeholder = field.placeholder
    ? FIELD_PLACEHOLDER_ES[field.key] ?? field.placeholder
    : FIELD_PLACEHOLDER_ES[field.key];
  const options = field.options?.map((o) => ({
    ...o,
    label: ALLERGY_PRESET_ES[o.label] ?? o.label,
  }));
  return {
    ...field,
    label,
    helperText,
    placeholder,
    options,
  };
}

export function translateSectionForDisplay(
  locale: RegistrationLocale,
  section: FormSectionDef,
): FormSectionDef {
  if (locale === "en") return section;
  return {
    ...section,
    title: translateSectionTitle(locale, section.title),
    description: translateSectionDescription(locale, section.description),
  };
}

export function translateAllergyPreset(locale: RegistrationLocale, option: string): string {
  if (locale === "en") return option;
  return ALLERGY_PRESET_ES[option] ?? option;
}

/** Best-effort translation for server-returned English messages. */
export function translateServerMessage(locale: RegistrationLocale, message: string): string {
  if (locale === "en" || !message.trim()) return message;
  const m = message.trim();
  const exact: Record<string, string> = {
    "Something went wrong. Please try again in a few minutes.":
      "Algo salió mal. Intente de nuevo en unos minutos.",
    "Choose a valid program.": "Elija un programa válido.",
    "Online registration is closed for this season.":
      "El registro en línea está cerrado para esta temporada.",
    "Registration is not available for this season right now.":
      "El registro no está disponible para esta temporada en este momento.",
    "Registration is not open during this date range.":
      "El registro no está abierto durante este rango de fechas.",
    "This registration form is not configured correctly. Please contact the church.":
      "Este formulario no está configurado correctamente. Contacte la iglesia.",
    "Unable to submit this form.": "No se pudo enviar este formulario.",
    "Please confirm your information is accurate before submitting.":
      "Confirme que su información es correcta antes de enviar.",
    "Please provide a phone number to receive SMS updates.":
      "Proporcione un número de teléfono para recibir avisos por SMS.",
    "This page is out of date. Please refresh and submit again.":
      "Esta página está desactualizada. Actualice y envíe de nuevo.",
    "Invalid date of birth for one or more children.":
      "Fecha de nacimiento inválida para uno o más niños.",
    "Invalid payment choice. Please try again.":
      "Opción de pago inválida. Intente de nuevo.",
    "Pay later is not available for this form.":
      "Pagar después no está disponible para este formulario.",
  };
  if (exact[m]) return exact[m];

  const ageMin = /^(.+): Must be at least (\d+) years old as of (.+)\.$/.exec(m);
  if (ageMin) {
    return `${ageMin[1]}: Debe tener al menos ${ageMin[2]} años al ${ageMin[3]}.`;
  }
  const ageMax = /^(.+): Must be at most (\d+) years old as of (.+)\.$/.exec(m);
  if (ageMax) {
    return `${ageMax[1]}: Debe tener como máximo ${ageMax[2]} años al ${ageMax[3]}.`;
  }

  const childRequired = /^Child (\d+): (.+) is required\.$/.exec(m);
  if (childRequired) {
    return `Niño ${childRequired[1]}: ${childRequired[2]} es obligatorio.`;
  }

  const fieldRequired = /^(.+) is required\.$/.exec(m);
  if (fieldRequired) {
    return `${fieldRequired[1]} es obligatorio.`;
  }

  return m;
}

export function formatRegistrationDate(asOfDate: Date, locale: RegistrationLocale): string {
  return asOfDate.toLocaleDateString(locale === "es" ? "es-US" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeWaiverText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Translate known waiver title/description/body for Spanish display. Custom admin copy is returned unchanged. */
export function translateWaiverDisplay(
  locale: RegistrationLocale,
  content: WaiverDisplayContent,
): WaiverDisplayContent {
  if (locale === "en") return content;

  const titleKey = normalizeWaiverText(content.title);
  const descKey = content.description ? normalizeWaiverText(content.description) : null;
  const bodyKey = normalizeWaiverText(content.body);

  const title =
    titleKey === normalizeWaiverText(DEFAULT_WAIVER_TITLE) ||
    titleKey === "Medical Liability Release Form"
      ? DEFAULT_WAIVER_TITLE_ES
      : content.title;

  const description =
    descKey &&
    (descKey === normalizeWaiverText(DEFAULT_WAIVER_DESCRIPTION) ||
      descKey.startsWith(
        "This form is to be completed by a parent or guardian of any child below 18 years",
      ))
      ? DEFAULT_WAIVER_DESCRIPTION_ES
      : content.description;

  const body =
    bodyKey === normalizeWaiverText(DEFAULT_WAIVER_BODY) ||
    bodyKey.includes("Parent Medical and Liability Release Statement") ||
    bodyKey.includes("I agree not to hold IPC Hebron Houston")
      ? DEFAULT_WAIVER_BODY_ES
      : content.body;

  return { title, description, body };
}

