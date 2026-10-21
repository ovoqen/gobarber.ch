import { NavTabs } from "@/components/ui";
export const PARTNER_TABS: [string, string][] = [["/partenaire", "Calendrier"], ["/partenaire/disponibilites", "Mes horaires"], ["/partenaire/prestations", "Prestations et zones"], ["/partenaire/revenus", "Revenus"], ["/partenaire/profil", "Profil et documents"]];
export const PNav = ({ current }: { current: string }) => <NavTabs current={current} items={PARTNER_TABS} />;
