import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { SiLanguage } from "react-icons/si";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
      className="bg-background/80 backdrop-blur-sm flex items-center gap-2"
    >
      <SiLanguage className="h-4 w-4" />
      <span>{language === 'id' ? 'ID' : 'EN'}</span>
    </Button>
  );
}