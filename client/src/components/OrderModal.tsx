import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiInstagram } from "react-icons/si";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { MenuItem } from "@shared/schema";

interface OrderModalProps {
  trigger?: React.ReactNode;
  item?: MenuItem;  // Make item optional since navbar doesn't pass it
}

export function OrderModal({ trigger }: OrderModalProps) {
  const { t } = useLanguage();

  // framer-motion and react-icons imports removed during optimization

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
        <div className="grid grid-cols-3 gap-4 p-2"> {/* Removed motion.div */}
          <a
            href="https://shopee.co.id/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          > {/*Removed motion.a */}
            <X className="w-12 h-12 text-[#EE4D2D]" /> {/* Replaced SiShopee with X for demonstration */}
            <span className="mt-2 text-sm font-medium">Shopee</span>
          </a>

          <a
            href="https://instagram.com/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          > {/*Removed motion.a */}
            <SiInstagram className="w-12 h-12 text-[#E4405F]" />
            <span className="mt-2 text-sm font-medium">Instagram</span>
          </a>

          <a
            href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          > {/*Removed motion.a */}
            <img
              src="/grab-logo.svg"
              alt="Grab"
              className="w-12 h-12"
            />
            <span className="mt-2 text-sm font-medium">Grab</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}