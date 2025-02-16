
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BlogPost, InsertBlogPost } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminBlogPage() {
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch blog posts
  const { data: posts, isLoading, error } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  // Create blog post
  const createMutation = useMutation({
    mutationFn: async (newPost: Partial<InsertBlogPost>) => {
      const response = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(newPost),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update blog post
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<InsertBlogPost>;
    }) => {
      const response = await fetch(`/api/blog/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post updated successfully" });
      setEditingPost(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete blog post
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/blog/${id}`, {
        method: "DELETE",
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete post");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      published: formData.get("published") === "true" ? 1 : 0,
    };

    try {
      if (editingPost) {
        await updateMutation.mutateAsync({ id: editingPost.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>Failed to load blog posts</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Blog Posts</h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create New Post
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Create Blog Post</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input name="title" required className="w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea 
                  name="content" 
                  required 
                  className="min-h-[200px]"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="checkbox"
                  name="published"
                  value="true"
                  className="w-4 h-4"
                  id="published"
                />
                <label htmlFor="published" className="text-sm font-medium">
                  Publish immediately
                </label>
              </div>
              <Button type="submit" className="w-full">
                Create Post
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          {posts?.map((post) => (
            <Card key={post.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">{post.title}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-gray-700">{post.content}</p>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>Status: {post.published ? 'Published' : 'Draft'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEditingPost(post)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this post?')) {
                        deleteMutation.mutate(post.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {editingPost && (
        <Sheet open={!!editingPost} onOpenChange={() => setEditingPost(null)}>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Edit Blog Post</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
              key={editingPost.id}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  name="title"
                  defaultValue={editingPost.title}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  name="content"
                  defaultValue={editingPost.content}
                  required
                  className="min-h-[200px]"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="checkbox"
                  name="published"
                  value="true"
                  defaultChecked={editingPost.published === 1}
                  className="w-4 h-4"
                  id="edit-published"
                />
                <label htmlFor="edit-published" className="text-sm font-medium">
                  Published
                </label>
              </div>
              <Button type="submit" className="w-full">
                Update Post
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
