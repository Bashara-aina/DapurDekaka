import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
      className="fixed top-4 right-4 z-50"
    >
      {language.toUpperCase()}
    </Button>
  );
}
