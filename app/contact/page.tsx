"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const inquiryMessages = {
  workshop:
    "I'm interested in booking a D-NAV workshop. Here are the outcomes I'm hoping to achieve:",
  consulting:
    "I'd like to discuss a consulting engagement with the D-NAV team. Here's some context:",
};

type InquiryType = keyof typeof inquiryMessages;

export default function ContactPage() {
  const [inquiryType, setInquiryType] = useState<InquiryType | null>(null);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    organization: "",
    message: "",
  });
  const formAnchorRef = useRef<HTMLDivElement | null>(null);

  const placeholder = useMemo(() => {
    if (!inquiryType) {
      return "Tell us how we can help.";
    }
    return inquiryMessages[inquiryType];
  }, [inquiryType]);

  const handleInquirySelect = (type: InquiryType) => {
    setInquiryType(type);
    setFormValues((prev) => ({
      ...prev,
      message: prev.message ? prev.message : inquiryMessages[type] + " ",
    }));
    formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleChange = (
    field: keyof typeof formValues,
    value: string
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Contact &amp; Inquiries</h1>
        <p className="text-muted-foreground">
          Ready to explore D-NAV for your team or organization? Choose the path that fits
          best, or drop us a note below. We&apos;ll follow up with next steps right away.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Book a Workshop</CardTitle>
            <CardDescription>
              Facilitate a live D-NAV session for your team. We&apos;ll align on outcomes,
              timing, and customization options.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Share your team&apos;s focus areas and goals.</li>
              <li>Receive proposed agendas and available dates.</li>
              <li>Customize deliverables for your context.</li>
            </ul>
            <Button onClick={() => handleInquirySelect("workshop")}>Book a Workshop</Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Consulting Inquiry</CardTitle>
            <CardDescription>
              Partner with us on ongoing decision-making support. We&apos;ll design a roadmap
              tailored to your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Outline the decisions you&apos;re navigating.</li>
              <li>Understand our advisory model and cadence.</li>
              <li>Co-create metrics that matter to your team.</li>
            </ul>
            <Button variant="outline" onClick={() => handleInquirySelect("consulting")}>
              Consulting Inquiry
            </Button>
          </CardContent>
        </Card>
      </section>

      <section ref={formAnchorRef} id="contact-form" className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Send us a message</h2>
          <p className="text-sm text-muted-foreground">
            Fill out the form and we&apos;ll get back to you within one business day.
          </p>
          {inquiryType && (
            <p className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
              You&apos;re inquiring about: <span className="font-semibold">{inquiryType === "workshop" ? "Booking a Workshop" : "Consulting Support"}</span>
            </p>
          )}
        </div>

        <form
          name="contact"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          action="/thanks"
          className="space-y-5"
        >
          <input type="hidden" name="form-name" value="contact" />
          <div className="hidden">
            <label htmlFor="bot-field">Don&apos;t fill this out if you&apos;re human</label>
            <input id="bot-field" name="bot-field" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="name"
                name="name"
                value={formValues.name}
                onChange={(event) => handleChange("name", event.target.value)}
                required
                placeholder="Your full name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                name="email"
                value={formValues.email}
                onChange={(event) => handleChange("email", event.target.value)}
                required
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="organization" className="text-sm font-medium text-foreground">
              Organization
            </label>
            <Input
              id="organization"
              name="organization"
              value={formValues.organization}
              onChange={(event) => handleChange("organization", event.target.value)}
              placeholder="Company or team name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="message" className="text-sm font-medium text-foreground">
              Message
            </label>
            <Textarea
              id="message"
              name="message"
              value={formValues.message}
              onChange={(event) => handleChange("message", event.target.value)}
              placeholder={placeholder}
              required
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">Send message</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
