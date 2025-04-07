import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Mail, Instagram as InstagramIcon, Loader2 } from "lucide-react";
import { Icon } from "@iconify/react";
import { TranslateWrapper } from "@/components/TranslateWrapper";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type ContactPageContent = {
  title: string;
  description: string;
  mainImage: string;
  contactInfo: {
    address: string;
    phone: string;
    email: string;
    openingHours: string;
    mapEmbedUrl: string;
  };
  socialLinks: {
    id: string;
    label: string;
    url: string;
    icon: string;
  }[];
  quickOrderUrl: string;
};

export default function Contact() {
  const [pageContent, setPageContent] = useState<ContactPageContent | null>(null);
  
  // Fetch contact page data from API
  const { data, isLoading } = useQuery({
    queryKey: ['/api/pages/contact'],
    queryFn: async () => {
      const response = await fetch('/api/pages/contact');
      if (!response.ok) {
        throw new Error('Failed to fetch contact page data');
      }
      return response.json();
    }
  });

  useEffect(() => {
    if (data && data.content) {
      setPageContent(data.content);
    }
  }, [data]);

  // Render loading state while fetching data
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center items-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Get icon component based on icon string
  const getSocialIcon = (iconString: string) => {
    if (iconString === 'lucide:instagram') {
      return <InstagramIcon className="h-5 w-5" />;
    }
    return <Icon icon={iconString} className="h-5 w-5" />;
  };

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            <TranslateWrapper translationKey="common.contact.title">
              {pageContent?.title || "Contact Us"}
            </TranslateWrapper>
          </h1>
          <p className="text-lg text-gray-600">
            <TranslateWrapper>
              {pageContent?.description || "Get in touch with us for any inquiries about our premium halal dim sum. We'd love to hear from you!"}
            </TranslateWrapper>
          </p>
        </motion.div>

        {pageContent?.mainImage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <div className="rounded-xl overflow-hidden h-[200px] md:h-[300px] w-full">
              <img 
                src={pageContent.mainImage} 
                alt="Contact Us" 
                className="w-full h-full object-cover object-center" 
              />
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6">
                  Contact Information
                </h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold">Address</h3>
                      <p className="text-gray-600">
                        {pageContent?.contactInfo?.address || "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Phone className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Phone</h3>
                      <p className="text-gray-600">{pageContent?.contactInfo?.phone || "+62 8229-5986-407"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Mail className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Email</h3>
                      <p className="text-gray-600">{pageContent?.contactInfo?.email || "dapurdekaka@gmail.com"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-semibold mb-4">Follow Us</h3>
                  <div className="flex gap-4">
                    {pageContent?.socialLinks?.map((link) => (
                      <Button key={link.id} variant="outline" size="icon" asChild>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary"
                          aria-label={link.label}
                        >
                          {getSocialIcon(link.icon)}
                        </a>
                      </Button>
                    )) || (
                      <>
                        <Button variant="outline" size="icon" asChild>
                          <a
                            href="https://shopee.co.id/dapurdekaka"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary"
                          >
                            <Icon icon="simple-icons:shopee" className="h-5 w-5" />
                          </a>
                        </Button>
                        <Button variant="outline" size="icon" asChild>
                          <a
                            href="https://instagram.com/dapurdekaka"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary"
                          >
                            <InstagramIcon className="h-5 w-5" />
                          </a>
                        </Button>
                        <Button variant="outline" size="icon" asChild>
                          <a
                            href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary"
                          >
                            <Icon
                              icon="simple-icons:grab"
                              className="h-5 w-5"
                            />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Opening Hours</h2>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily</span>
                    <span>{pageContent?.contactInfo?.openingHours || "07:30 - 20:00"}</span>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-semibold mb-4">Quick Order</h3>
                  <Button className="w-full" size="lg" asChild>
                    <a
                      href={pageContent?.quickOrderUrl || "https://wa.me/6282295986407"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Order via WhatsApp
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Interactive Map Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="w-full"
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-6">Find Us</h2>
              <div className="aspect-video w-full rounded-lg overflow-hidden">
                <iframe
                  src={pageContent?.contactInfo?.mapEmbedUrl || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.628663657452!2d107.62787277454113!3d-6.934907867883335!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e98f06fbfe3f%3A0xd60d9e2dbd74a207!2sDapur%20Dekaka!5e0!3m2!1sid!2sid!4v1739461694952!5m2!1sid!2sid"}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-lg"
                ></iframe>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
