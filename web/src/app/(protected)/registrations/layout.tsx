import { RegistrationsSectionNav } from "./registrations-section-nav";

export default function RegistrationsSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <RegistrationsSectionNav />
      {children}
    </div>
  );
}
