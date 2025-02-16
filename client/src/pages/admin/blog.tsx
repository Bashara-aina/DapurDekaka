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
import { Pencil, Trash2 } from "lucide-react";

export default function AdminBlogPage() {
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch blog posts
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
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
        body: JSON.stringify(newPost),
      });
      if (!response.ok) throw new Error("Failed to create post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post created successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create blog post",
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
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post updated successfully" });
      setEditingPost(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update blog post",
        variant: "destructive",
      });
    },
  });

  // Delete blog post
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/blog/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete post");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete blog post",
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

    if (editingPost) {
      await updateMutation.mutateAsync({ id: editingPost.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    
    (e.target as HTMLFormElement).reset();
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Blog Posts</h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button>Create New Post</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Create Blog Post</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea name="content" required className="min-h-[200px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  <Input
                    type="checkbox"
                    name="published"
                    value="true"
                    className="mr-2"
                  />
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

      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {posts?.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{post.title}</h2>
                  <p className="text-muted-foreground mt-1">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2">{post.content}</p>
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
                    onClick={() => deleteMutation.mutate(post.id)}
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
          <SheetContent>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  <Input
                    type="checkbox"
                    name="published"
                    value="true"
                    defaultChecked={editingPost.published === 1}
                    className="mr-2"
                  />
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
