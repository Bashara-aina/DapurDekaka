import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, PlusCircle } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Testimonial interface
interface Testimonial {
  id: string;
  name: string;
  position: string;
  company: string;
  image: string;
  content: string;
}

// Customer logo interface
interface CustomerLogo {
  url: string;
}

// Customers section interface
interface CustomersSection {
  title: string;
  subtitle: string;
  logos: string[];
  testimonials: Testimonial[];
}

// Preview component for the Customers section
const CustomersPreview = ({ data }: { data: CustomersSection }) => {
  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900">{data.title}</h2>
        <p className="text-gray-600 mt-2">{data.subtitle}</p>
      </div>

      <div className="mb-10">
        <h3 className="text-xl font-bold mb-4">Customer Logos</h3>
        <div className="flex flex-wrap gap-4 justify-center">
          {data.logos.map((logo, index) => (
            <div key={index} className="w-24 h-24 flex items-center justify-center p-2 border rounded">
              <img src={logo} alt={`Customer logo ${index + 1}`} className="max-w-full max-h-full object-contain" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Testimonials</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {data.testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                {testimonial.image && (
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <h4 className="font-semibold">{testimonial.name}</h4>
                  <p className="text-sm text-gray-600">{testimonial.position}, {testimonial.company}</p>
                </div>
              </div>
              <p className="italic text-gray-700">"{testimonial.content}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function CustomersPageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [files, setFiles] = useState<{ [key: string]: File[] }>({
    logos: [],
    testimonialImages: []
  });

  // Form state for customer section
  const [customersData, setCustomersData] = useState<CustomersSection>({
    title: "",
    subtitle: "",
    logos: [],
    testimonials: []
  });

  // Temporary state for new testimonial
  const [newTestimonial, setNewTestimonial] = useState<Partial<Testimonial>>({
    name: "",
    position: "",
    company: "",
    content: ""
  });
  const [selectedTestimonialId, setSelectedTestimonialId] = useState<string | null>(null);

  // Fetch homepage data
  const { data: pageData, isLoading } = useQuery({
    queryKey: ["homepage"],
    queryFn: async () => {
      const response = await fetch('/api/pages/homepage', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      if (!response.ok) throw new Error('Failed to fetch homepage data');
      return response.json();
    }
  });

  // Initialize form with data from API
  useEffect(() => {
    if (pageData?.content?.customers) {
      setCustomersData({
        title: pageData.content.customers.title || "Our Customers",
        subtitle: pageData.content.customers.subtitle || "Trusted by businesses across Indonesia",
        logos: pageData.content.customers.logos || [],
        testimonials: pageData.content.customers.testimonials || []
      });
    }
  }, [pageData]);

  // Update homepage data mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      // Add logo files if any
      files.logos?.forEach(file => {
        formData.append('customerLogos', file);
      });
      
      // Add testimonial image files if any
      files.testimonialImages?.forEach((file, index) => {
        formData.append(`testimonialImage_${index}`, file);
      });
      
      // Add the updated customers section data
      formData.append('content', JSON.stringify({
        customers: customersData
      }));

      const response = await fetch('/api/pages/homepage', {
        method: 'PUT',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update customers section');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      toast({
        title: "Success",
        description: "Customers section updated successfully",
      });
      // Reset file selection
      setFiles({ logos: [], testimonialImages: [] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customers section",
        variant: "destructive"
      });
    }
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  // Handle adding a new testimonial
  const handleAddTestimonial = () => {
    if (!newTestimonial.name || !newTestimonial.content) {
      toast({
        title: "Missing Information",
        description: "Please provide at least a name and testimonial content.",
        variant: "destructive"
      });
      return;
    }

    const newId = Date.now().toString();
    const testimonial: Testimonial = {
      id: newId,
      name: newTestimonial.name || "",
      position: newTestimonial.position || "",
      company: newTestimonial.company || "",
      image: "/asset/1.jpg", // Default image
      content: newTestimonial.content || ""
    };

    setCustomersData(prev => ({
      ...prev,
      testimonials: [...prev.testimonials, testimonial]
    }));

    // Reset the form
    setNewTestimonial({
      name: "",
      position: "",
      company: "",
      content: ""
    });
  };

  // Handle editing a testimonial
  const handleEditTestimonial = (testimonial: Testimonial) => {
    setSelectedTestimonialId(testimonial.id);
    setNewTestimonial({
      name: testimonial.name,
      position: testimonial.position,
      company: testimonial.company,
      content: testimonial.content
    });
  };

  // Handle updating an existing testimonial
  const handleUpdateTestimonial = () => {
    if (!selectedTestimonialId) return;

    setCustomersData(prev => ({
      ...prev,
      testimonials: prev.testimonials.map(item => 
        item.id === selectedTestimonialId 
          ? { 
              ...item, 
              name: newTestimonial.name || item.name,
              position: newTestimonial.position || item.position,
              company: newTestimonial.company || item.company,
              content: newTestimonial.content || item.content
            } 
          : item
      )
    }));

    // Reset form and selection
    setNewTestimonial({
      name: "",
      position: "",
      company: "",
      content: ""
    });
    setSelectedTestimonialId(null);
  };

  // Handle deleting a testimonial
  const handleDeleteTestimonial = (id: string) => {
    setCustomersData(prev => ({
      ...prev,
      testimonials: prev.testimonials.filter(item => item.id !== id)
    }));

    // If the deleted testimonial was selected, reset the form
    if (selectedTestimonialId === id) {
      setNewTestimonial({
        name: "",
        position: "",
        company: "",
        content: ""
      });
      setSelectedTestimonialId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AdminNavbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Customers Section Editor</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="logos">Customer Logos</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Edit the section title and subtitle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Section Title
                    </label>
                    <Input
                      value={customersData.title}
                      onChange={(e) => setCustomersData(prev => ({
                        ...prev,
                        title: e.target.value
                      }))}
                      placeholder="Our Customers"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Section Subtitle
                    </label>
                    <Input
                      value={customersData.subtitle}
                      onChange={(e) => setCustomersData(prev => ({
                        ...prev,
                        subtitle: e.target.value
                      }))}
                      placeholder="Trusted by businesses across Indonesia"
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logos">
            <Card>
              <CardHeader>
                <CardTitle>Customer Logos</CardTitle>
                <CardDescription>
                  Add or remove customer logos that will be displayed in a scrolling section
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Upload Logos (PNG or JPG recommended)
                    </label>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setFiles(prev => ({ 
                        ...prev, 
                        logos: Array.from(e.target.files || []) 
                      }))}
                      className="mb-4"
                    />
                    <p className="text-sm text-gray-500 mb-4">
                      Uploaded logos will be added to the existing collection
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-3">Current Logos</h3>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {customersData.logos.map((logo, index) => (
                        <div key={index} className="relative border rounded p-2 bg-white">
                          <img 
                            src={logo} 
                            alt={`Customer ${index + 1}`} 
                            className="w-full h-24 object-contain"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => {
                              setCustomersData(prev => ({
                                ...prev,
                                logos: prev.logos.filter((_, i) => i !== index)
                              }));
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testimonials">
            <Card>
              <CardHeader>
                <CardTitle>Customer Testimonials</CardTitle>
                <CardDescription>
                  Manage customer testimonials to showcase your business reputation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-medium mb-3">
                      {selectedTestimonialId ? "Edit Testimonial" : "Add New Testimonial"}
                    </h3>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block mb-2 text-sm font-medium">
                            Name
                          </label>
                          <Input
                            value={newTestimonial.name || ""}
                            onChange={(e) => setNewTestimonial(prev => ({
                              ...prev,
                              name: e.target.value
                            }))}
                            placeholder="Customer Name"
                          />
                        </div>
                        <div>
                          <label className="block mb-2 text-sm font-medium">
                            Position
                          </label>
                          <Input
                            value={newTestimonial.position || ""}
                            onChange={(e) => setNewTestimonial(prev => ({
                              ...prev,
                              position: e.target.value
                            }))}
                            placeholder="Job Title"
                          />
                        </div>
                        <div>
                          <label className="block mb-2 text-sm font-medium">
                            Company
                          </label>
                          <Input
                            value={newTestimonial.company || ""}
                            onChange={(e) => setNewTestimonial(prev => ({
                              ...prev,
                              company: e.target.value
                            }))}
                            placeholder="Company Name"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium">
                          Testimonial Content
                        </label>
                        <Textarea
                          value={newTestimonial.content || ""}
                          onChange={(e) => setNewTestimonial(prev => ({
                            ...prev,
                            content: e.target.value
                          }))}
                          placeholder="What the customer said about your product or service"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium">
                          Profile Photo (optional)
                        </label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setFiles(prev => ({
                                ...prev,
                                testimonialImages: [e.target.files![0]]
                              }));
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        {selectedTestimonialId ? (
                          <>
                            <Button
                              type="button"
                              onClick={handleUpdateTestimonial}
                            >
                              Update Testimonial
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSelectedTestimonialId(null);
                                setNewTestimonial({
                                  name: "",
                                  position: "",
                                  company: "",
                                  content: ""
                                });
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            onClick={handleAddTestimonial}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Testimonial
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-3">Current Testimonials</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {customersData.testimonials.map((testimonial) => (
                        <div key={testimonial.id} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-center gap-3 mb-3">
                            {testimonial.image && (
                              <img 
                                src={testimonial.image} 
                                alt={testimonial.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <h4 className="font-semibold">{testimonial.name}</h4>
                              <p className="text-sm text-gray-600">
                                {testimonial.position}, {testimonial.company}
                              </p>
                            </div>
                          </div>
                          <p className="text-gray-700 mb-3">"{testimonial.content}"</p>
                          <div className="flex gap-2 justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTestimonial(testimonial)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteTestimonial(testimonial.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save All Changes"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Preview how the customers section will appear on the website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomersPreview data={customersData} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}