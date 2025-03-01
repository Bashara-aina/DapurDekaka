import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SiShopee, SiInstagram } from "react-icons/si";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { MenuItem, Sauce } from "@shared/schema";

interface OrderModalProps {
  trigger?: React.ReactNode;
  menuItem?: MenuItem | Sauce;  // Make menuItem optional and accept either MenuItem or Sauce
}

export function OrderModal({ trigger, menuItem }: OrderModalProps) {
  const { t } = useLanguage();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="lg">
            {t('menu.orderNow')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-4 p-2"
        >
          {menuItem && (
            <div className="col-span-3 mb-4">
              <h3 className="text-lg font-semibold mb-2">{menuItem.name}</h3>
              <p className="text-sm text-gray-600">{menuItem.description}</p>
            </div>
          )}
          <motion.a
            variants={item}
            href="https://shopee.co.id/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <SiShopee className="w-12 h-12 text-[#EE4D2D]" />
            <span className="mt-2 text-sm font-medium">Shopee</span>
          </motion.a>

          <motion.a
            variants={item}
            href="https://instagram.com/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <SiInstagram className="w-12 h-12 text-[#E4405F]" />
            <span className="mt-2 text-sm font-medium">Instagram</span>
          </motion.a>

          <motion.a
            variants={item}
            href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <img
              src="/grab-logo.svg"
              alt="Grab"
              className="w-12 h-12"
            />
            <span className="mt-2 text-sm font-medium">Grab</span>
          </motion.a>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}