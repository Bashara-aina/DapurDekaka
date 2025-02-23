const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log("Sending form data:", Object.fromEntries(formData.entries()));
      const response = await fetch("/api/menu", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create menu item: ${error}`);
      }
      return response.json();
    },
  });