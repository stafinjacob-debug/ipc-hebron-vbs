/** Default IPC Hebron medical / liability waiver shown on registration when admin has not customized copy. */

export const DEFAULT_WAIVER_TITLE = "Medical Liability Release Form";

export const DEFAULT_WAIVER_DESCRIPTION =
  "This form is to be completed by a parent or guardian of any child below 18 years who will be under a supervision of another adult volunteer in church for reason not limited to Nursery, Children's Church, Sunday School, or other church related activities.";

export const DEFAULT_WAIVER_BODY = `Parent Medical and Liability Release Statement

I understand all reasonable safety precautions will be taken at all times by IPC Hebron, Houston during the activities and events. I understand that in the event of a situation when medical intervention is needed, every attempt will be made to contact immediately the person(s) listed on the form. In the event I cannot be reached in an emergency during the church related activities of the IPC Hebron, Houston. I hereby give my permission to the volunteer or medical team to provide first aid or medical treatment to my child as deemed necessary. I understand the possibility of unforeseen hazards and know the inherent possibility of risk. I agree not to hold IPC Hebron Houston, its leaders, and volunteer staff liable for damages, losses, diseases, or injuries incurred to my child.`;

export const DEFAULT_WAIVER_TITLE_ES = "Formulario de exención médica y de responsabilidad";

export const DEFAULT_WAIVER_DESCRIPTION_ES =
  "Este formulario debe ser completado por el padre, madre o tutor legal de cualquier menor de 18 años que estará bajo la supervisión de un voluntario adulto de la iglesia por motivos que incluyen, entre otros, guardería, Escuela Dominical, escuela bíblica de niños u otras actividades relacionadas con la iglesia.";

export const DEFAULT_WAIVER_BODY_ES = `Declaración médica y de exención de responsabilidad del padre/madre o tutor

Entiendo que IPC Hebron, Houston tomará todas las precauciones razonables de seguridad en todo momento durante las actividades y eventos. Entiendo que, si se necesita intervención médica, se hará todo lo posible por contactar de inmediato a la(s) persona(s) indicadas en este formulario. En caso de que no pueda ser localizado(a) en una emergencia durante las actividades de la iglesia de IPC Hebron, Houston, doy mi permiso al voluntario o equipo médico para brindar primeros auxilios o tratamiento médico a mi hijo(a) según sea necesario. Entiendo la posibilidad de riesgos imprevistos y el riesgo inherente de participar. Acepto no responsabilizar a IPC Hebron Houston, sus líderes ni su personal voluntario por daños, pérdidas, enfermedades o lesiones sufridas por mi hijo(a).`;

export type WaiverDisplayContent = {
  title: string;
  description: string | null;
  body: string;
};

/** Resolve waiver copy for display (fills in church defaults when fields are empty). */
export function resolveWaiverDisplayContent(input: {
  title?: string | null;
  description?: string | null;
  body?: string | null;
}): WaiverDisplayContent {
  return {
    title: input.title?.trim() || DEFAULT_WAIVER_TITLE,
    description: input.description?.trim() || DEFAULT_WAIVER_DESCRIPTION,
    body: input.body?.trim() || DEFAULT_WAIVER_BODY,
  };
}
