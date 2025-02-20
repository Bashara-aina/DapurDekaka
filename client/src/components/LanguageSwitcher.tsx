import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
      className="absolute top-4 right-4 z-50 bg-background/80 backdrop-blur-sm"
    >
      {language.toUpperCase()}
    </Button>
  );
}