"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const contactEmail = "vudi@thednav.com";

const inquiryCopy = {
  workshop: {
    subject: "D-NAV Workshop Inquiry",
    body: "Hello D-NAV team,\n\nI'm interested in booking a D-NAV workshop. Here are the outcomes I'm hoping to achieve:\n- ",
  },
  consulting: {
    subject: "D-NAV Consulting Inquiry",
    body: "Hello D-NAV team,\n\nI'd like to discuss a consulting engagement with the D-NAV team. Here's some context:\n- ",
  },
};

const mailtoLink = (type: keyof typeof inquiryCopy) => {
  const { subject, body } = inquiryCopy[type];
  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${contactEmail}?${params.toString()}`;
};

export default function ContactPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Contact &amp; Inquiries</h1>
        <p className="text-muted-foreground">
          Ready to explore D-NAV for your team or organization? Choose the path that fits
          best and we&apos;ll follow up with next steps right away.
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
            <Button asChild>
              <a href={mailtoLink("workshop")}>Book a Workshop</a>
            </Button>
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
            <Button asChild variant="outline">
              <a href={mailtoLink("consulting")}>Consulting Inquiry</a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
