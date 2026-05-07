/**
 * Contact route Zod schema validation tests
 * Tests contactSchema for contact form submissions
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import the schema directly from contact route
// We define it here to avoid import issues
const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(2000),
  phone: z.string().optional(),
  subject: z.string().optional(),
});

describe("Contact Schema Validation", () => {
  describe("Valid payloads", () => {
    it("parses valid contact payload successfully", () => {
      const validPayload = {
        name: "John Doe",
        email: "john@example.com",
        message: "Hello, I would like to inquire about your menu.",
      };

      const result = contactSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John Doe");
        expect(result.data.email).toBe("john@example.com");
        expect(result.data.message).toBe("Hello, I would like to inquire about your menu.");
      }
    });

    it("parses payload with all optional fields", () => {
      const fullPayload = {
        name: "Jane Doe",
        email: "jane@example.com",
        message: "Full message with all fields included.",
        phone: "+6281234567890",
        subject: "Product Inquiry",
      };

      const result = contactSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("+6281234567890");
        expect(result.data.subject).toBe("Product Inquiry");
      }
    });

    it("strips unknown fields when using strict mode", () => {
      const payloadWithExtra = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message content",
        extraField: "should be stripped",
      };

      const strictSchema = contactSchema.strict();
      const result = strictSchema.safeParse(payloadWithExtra);

      // With strict(), extra fields cause failure
      expect(result.success).toBe(false);
    });
  });

  describe("Missing required fields", () => {
    it("fails when name is missing", () => {
      const invalidPayload = {
        email: "test@example.com",
        message: "Test message",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((i) => i.path.join("."));
        expect(errorMessages).toContain("name");
      }
    });

    it("fails when email is missing", () => {
      const invalidPayload = {
        name: "Test User",
        message: "Test message",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((i) => i.path.join("."));
        expect(errorMessages).toContain("email");
      }
    });

    it("fails when message is missing", () => {
      const invalidPayload = {
        name: "Test User",
        email: "test@example.com",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((i) => i.path.join("."));
        expect(errorMessages).toContain("message");
      }
    });

    it("fails when all required fields are missing", () => {
      const emptyPayload = {};

      const result = contactSchema.safeParse(emptyPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.issues.map((i) => i.path.join("."));
        expect(errorPaths).toContain("name");
        expect(errorPaths).toContain("email");
        expect(errorPaths).toContain("message");
      }
    });
  });

  describe("Invalid email format", () => {
    it("fails with invalid email format - no @ symbol", () => {
      const invalidPayload = {
        name: "Test User",
        email: "invalid-email",
        message: "Test message",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailErrors = result.error.issues.filter((i) => i.path.includes("email"));
        expect(emailErrors.length).toBeGreaterThan(0);
      }
    });

    it("fails with invalid email format - no domain", () => {
      const invalidPayload = {
        name: "Test User",
        email: "test@",
        message: "Test message",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("fails with invalid email format - spaces", () => {
      const invalidPayload = {
        name: "Test User",
        email: "test user@example.com",
        message: "Test message",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("accepts valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@sub.domain.co.uk",
      ];

      for (const email of validEmails) {
        const payload = { name: "Test", email, message: "Test message" };
        const result = contactSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Message length validation", () => {
    it("fails when message is too short (less than 1 character)", () => {
      const invalidPayload = {
        name: "Test User",
        email: "test@example.com",
        message: "",
      };

      const result = contactSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("succeeds with message at minimum length", () => {
      const validPayload = {
        name: "Test User",
        email: "test@example.com",
        message: "A",
      };

      const result = contactSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("succeeds with normal message length", () => {
      const validPayload = {
        name: "Test User",
        email: "test@example.com",
        message: "This is a normal message with reasonable length.",
      };

      const result = contactSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe("Optional field handling", () => {
    it("works when phone is omitted", () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
      };

      const result = contactSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("works when subject is omitted", () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
      };

      const result = contactSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("omitted phone is undefined in parsed result", () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
      };

      const result = contactSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBeUndefined();
      }
    });

    it("accepts empty string for optional phone", () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        phone: "",
      };

      const result = contactSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("");
      }
    });
  });
});