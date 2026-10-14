import { PolicyDocumentScreen } from "@/components/PolicyDocumentScreen";
import { communityRules } from "@/data/community-rules";

export default function CommunityRulesScreen() {
  return <PolicyDocumentScreen
    title="Quy tắc cộng đồng"
    intro={communityRules.intro}
    updatedAt={communityRules.updatedAt}
    sections={communityRules.sections}
    related={{ label: "Chính sách bảo mật", href: "/privacy-policy" }}
  />;
}
