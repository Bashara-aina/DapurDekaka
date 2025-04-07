
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SiShopee, SiInstagram, SiWhatsapp } from "react-icons/si";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { MenuItem, Sauce } from "@shared/schema";

interface OrderModalProps {
  trigger?: React.ReactNode;
  menuItem?: MenuItem | Sauce;
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
        {menuItem && (
          <div className="mb-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{menuItem.name}</h3>
            <p className="text-sm text-gray-600">{menuItem.description}</p>
          </div>
        )}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4"
        >
          <motion.a
            variants={item}
            href="https://shopee.co.id/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <SiShopee className="w-10 h-10 text-[#EE4D2D] mb-2" />
            <span className="text-sm font-medium">Shopee</span>
          </motion.a>

          <motion.a
            variants={item}
            href="https://instagram.com/dapurdekaka"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <SiInstagram className="w-10 h-10 text-[#E4405F] mb-2" />
            <span className="text-sm font-medium">Instagram</span>
          </motion.a>

          <motion.a
            variants={item}
            href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <img
              src="/grab-logo.svg"
              alt="Grab"
              className="w-10 h-10 mb-2"
            />
            <span className="text-sm font-medium">Grab</span>
          </motion.a>

          <motion.a
            variants={item}
            href="https://wa.me/6282295986407"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <SiWhatsapp className="w-10 h-10 text-[#25D366] mb-2" />
            <span className="text-sm font-medium">WhatsApp</span>
          </motion.a>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
