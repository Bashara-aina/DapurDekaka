import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { MenuItem } from "@shared/schema";

interface OrderModalProps {
  trigger?: React.ReactNode;
  item?: MenuItem;  
}

export function OrderModal({ trigger }: OrderModalProps) {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="lg">
            {t('common.orderNow')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <div className="grid grid-cols-3 gap-4 p-2"> 
          <a
            href="https://shopee.co.id/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          > 
            <ShoppingBag className="w-12 h-12 text-[#EE4D2D]" /> 
            <span className="mt-2 text-sm font-medium">Shopee</span>
          </a>

          <a
            href="https://instagram.com/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          > 
            <X className="w-12 h-12 text-[#E4405F]" /> {/*This line was changed*/}
            <span className="mt-2 text-sm font-medium">Instagram</span>
          </a>

          <a
            href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          > 
            <ShoppingBag className="w-12 h-12 text-[#00B14F]" /> 
            <span className="mt-2 text-sm font-medium">Grab</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}