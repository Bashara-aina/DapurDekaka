import { useState, useEffect } from "react";
import { Editor } from '@tinymce/tinymce-react';
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Pencil, Trash2, Plus, Image as ImageIcon, Loader2, ChevronUp, ChevronDown, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BLOG_CATEGORIES = [
  "dim sum",
  "recipes",
  "cooking tips",
  "food culture",
  "halal",
  "reviews",
  "news",
  "other"
] as const;

function BlogPostCardSkeleton() {
  return (
    <Card className="p-6 border border-gray-200 mb-4">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full mt-2" />
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AdminBlogPage() {
  const { t } = useLanguage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localBlogPosts, setLocalBlogPosts] = useState<BlogPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [deletePostId, setDeletePostId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts, isLoading: postsLoading } = useQuery<BlogPost[]>({
    queryKey: queryKeys.admin.blog,
    queryFn: () => apiRequest("/api/blog"),
    enabled: !!isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest("/api/blog", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
      toast({ title: t('common.messages.success'), description: t('admin.blog.created') });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.messages.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      return await apiRequest(`/api/blog/${id}`, {
        method: "PUT",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
      toast({ title: t('common.messages.success'), description: t('admin.blog.updated') });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.messages.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/blog/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
      toast({ title: t('common.messages.success'), description: t('admin.blog.deleted') });
      setDeletePostId(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('common.messages.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (postIds: number[]) => {
      return await apiRequest("/api/blog/reorder", {
        method: "POST",
        body: JSON.stringify({ postIds }),
      });
    },
    onMutate: async (newPostIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.blog });
      const previousPosts = queryClient.getQueryData<BlogPost[]>(queryKeys.admin.blog);

      setLocalBlogPosts(current => {
        const postMap = new Map(current.map(p => [p.id, p]));
        const reordered = newPostIds.map((id, idx) => {
          const post = postMap.get(id);
          return post ? { ...post, orderIndex: idx } : null;
        }).filter(Boolean) as BlogPost[];
        return reordered;
      });

      return { previousPosts };
    },
    onError: (_err, _newPostIds, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData<BlogPost[]>(queryKeys.admin.blog, context.previousPosts);
        setLocalBlogPosts(context.previousPosts);
      }
      toast({
        title: t('common.messages.error'),
        description: t('admin.blog.reorderFailed'),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
    },
  });

  useEffect(() => {
    if (posts) {
      setLocalBlogPosts(posts);
    }
  }, [posts]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMovePost = async (postId: number, direction: 'up' | 'down') => {
    const currentIndex = localBlogPosts.findIndex(post => post.id === postId);
    if (currentIndex === -1) return;
    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === localBlogPosts.length - 1)) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newPosts = [...localBlogPosts];
    const [movedPost] = newPosts.splice(currentIndex, 1);
    newPosts.splice(newIndex, 0, movedPost);
    const postIds = newPosts.map(post => post.id);

    reorderMutation.mutate(postIds);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = formData.get('title')?.toString().trim();
    const content = formData.get('content')?.toString().trim();

    if (!title || !content) {
      toast({
        title: t('common.messages.error'),
        description: `${t("admin.blog.titleLabel")} & ${t("admin.blog.contentLabel")} are required`,
        variant: "destructive",
      });
      return;
    }

    formData.set('title', title);
    formData.set('content', content);
    formData.set('published', published ? '1' : '0');
    formData.set('featured', featured ? '1' : '0');

    try {
      if (editingPost) {
        await updateMutation.mutateAsync({ id: editingPost.id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      form.reset();
      setEditingPost(null);
      setImagePreview(null);
      setIsEditing(false);
      setSelectedCategory('');
      setPublished(false);
      setFeatured(false);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openEditForm = (post: BlogPost) => {
    setEditingPost(post);
    setSelectedCategory(post.category || '');
    setPublished(post.published === 1);
    setFeatured(post.featured === 1);
    setIsEditing(true);
  };

  const openCreateForm = () => {
    setEditingPost(null);
    setSelectedCategory('');
    setPublished(false);
    setFeatured(false);
    setIsEditing(true);
  };

  if (authLoading || postsLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <BlogPostCardSkeleton key={i} />
            ))}
          </div>
        </ScrollArea>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isEditing) {
    return (
      <AdminLayout showNavbar={false}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {editingPost ? t("admin.blog.editPost") : t("admin.blog.createPost")}
          </h1>
          <Button onClick={() => {
            setIsEditing(false);
            setEditingPost(null);
            setImagePreview(null);
          }}>
            {t("admin.blog.backToPosts")}
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">{t("admin.blog.titleLabel")} *</Label>
            <Input
              id="title"
              name="title"
              defaultValue={editingPost?.title}
              required
              minLength={3}
              placeholder={t("admin.blog.titlePlaceholder")}
              className="text-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorName">{t("admin.blog.authorNameLabel")}</Label>
            <Input
              id="authorName"
              name="authorName"
              defaultValue={editingPost?.authorName || ''}
              placeholder={t("admin.blog.authorNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">{t("admin.blog.slugLabel")}</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={editingPost?.slug || ''}
              placeholder={t("admin.blog.slugPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t("admin.blog.categoryLabel")}</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category" name="category">
                <SelectValue placeholder={t("admin.blog.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {BLOG_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={selectedCategory} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">{t("admin.blog.imageLabel")}</Label>
            <Input
              id="image"
              type="file"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
            />
            {(imagePreview || editingPost?.imageUrl) && (
              <div className="mt-4">
                <img
                  src={imagePreview || editingPost?.imageUrl || ''}
                  alt="Preview"
                  className="max-h-[400px] w-full object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">{t("admin.blog.excerptLabel")}</Label>
            <Textarea
              id="excerpt"
              name="excerpt"
              defaultValue={editingPost?.excerpt || ''}
              placeholder={t("admin.blog.excerptPlaceholder")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">{t("admin.blog.contentLabel")} *</Label>
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
              init={{
                height: 500,
                menubar: true,
                setup: (editor) => {
                  editor.on('init', () => {
                    if (editingPost?.content) {
                      editor.setContent(editingPost.content);
                    }
                  });
                },
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | ' +
                  'bold italic | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
              }}
              initialValue={editingPost?.content || ''}
              textareaName="content"
              onEditorChange={(content) => {
                const textarea = document.querySelector('textarea[name="content"]');
                if (textarea) {
                  (textarea as HTMLTextAreaElement).value = content;
                }
              }}
            />
            <textarea name="content" defaultValue={editingPost?.content} hidden />
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="published"
                checked={published}
                onCheckedChange={setPublished}
              />
              <Label htmlFor="published" className="text-sm font-medium cursor-pointer">
                {t("admin.blog.published")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="featured"
                checked={featured}
                onCheckedChange={setFeatured}
              />
              <Label htmlFor="featured" className="text-sm font-medium cursor-pointer">
                {t("admin.blog.featuredLabel")}
              </Label>
            </div>
          </div>

          {editingPost?.readTime && (
            <div className="text-sm text-muted-foreground">
              {t("admin.blog.readTimeLabel")}: {editingPost.readTime} min
            </div>
          )}

          <Button type="submit" className="w-full">
            {editingPost ? t("admin.blog.updatePost") : t("admin.blog.createPost")}
          </Button>
        </form>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{t("admin.blog.title")}</h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}
              title={isAuthenticated ? t('admin.blog.loggedIn') : t('admin.blog.loggedOut')}
            />
            <span className="text-sm text-muted-foreground">
              {isAuthenticated ? t('admin.blog.loggedIn') : t('admin.blog.loggedOut')}
            </span>
          </div>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="w-4 h-4 mr-2" />
          {t("admin.blog.createNew")}
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">{t("admin.blog.useArrowsToReorder")}</p>
          {localBlogPosts.map((post, index) => (
            <Card key={post.id} className="p-6 border border-gray-200 hover:border-primary transition-colors mb-4">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {post.featured === 1 && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" aria-label="Featured" />
                    )}
                    <h2 className="text-xl font-semibold">{post.title}</h2>
                    {post.published !== 1 && (
                      <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                        Draft
                      </span>
                    )}
                  </div>
                  {post.authorName && (
                    <p className="text-sm text-gray-500">By {post.authorName}</p>
                  )}
                  {post.category && (
                    <span className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded-full capitalize">
                      {post.category}
                    </span>
                  )}
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                    {post.readTime && ` · ${post.readTime} min read`}
                  </p>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.excerpt}</p>
                  )}
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="mt-2 max-h-40 rounded-md"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <div className="flex flex-col justify-center items-center space-y-1 mb-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMovePost(post.id, 'up')}
                      disabled={index === 0 || reorderMutation.isPending}
                      title={t("admin.blog.moveUp")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-center text-muted-foreground">
                      {t('admin.blog.order')}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMovePost(post.id, 'down')}
                      disabled={index === localBlogPosts.length - 1 || reorderMutation.isPending}
                      title={t("admin.blog.moveDown")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditForm(post)}
                      title={t('admin.blog.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeletePostId(post.id)}
                          title={t('admin.blog.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.blog.deleteTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('admin.blog.deleteConfirm')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeletePostId(null)}>
                            {t('common.actions.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deletePostId && deleteMutation.mutate(deletePostId)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('common.actions.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </AdminLayout>
  );
}