import { PolicyDocumentScreen } from "@/components/PolicyDocumentScreen";
import { privacyPolicy } from "@/data/privacy-policy";

export default function PrivacyPolicyScreen() {
  return <PolicyDocumentScreen
    title="Chính sách bảo mật"
    intro={privacyPolicy.intro}
    updatedAt={privacyPolicy.updatedAt}
    sections={privacyPolicy.sections}
    related={{ label: "Quy tắc cộng đồng", href: "/community-rules" }}
    publicUrl="https://erp.igentechnology.net/privacy-policy"
  />;
}
