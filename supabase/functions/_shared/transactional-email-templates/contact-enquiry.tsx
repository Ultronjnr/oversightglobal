/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ContactEnquiryProps {
  name: string
  email: string
  phone?: string
  organisation?: string
  subject: string
  message: string
  submittedAt?: string
}

const ContactEnquiryEmail = ({
  name,
  email,
  phone,
  organisation,
  subject,
  message,
  submittedAt,
}: ContactEnquiryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Ovasyt enquiry — {subject} from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New website enquiry</Heading>
        <Text style={intro}>
          A new message has just come in through the Ovasyt contact form.
        </Text>

        <Section style={card}>
          <Row label="Subject" value={subject} />
          <Row label="Name" value={name} />
          <Row label="Email" value={email} />
          {phone ? <Row label="Phone" value={phone} /> : null}
          {organisation ? <Row label="Organisation" value={organisation} /> : null}
          {submittedAt ? <Row label="Received" value={submittedAt} /> : null}
        </Section>

        <Heading as="h2" style={h2}>Message</Heading>
        <Text style={messageBox}>{message}</Text>

        <Hr style={hr} />
        <Text style={footer}>
          Reply directly to {email} to respond to this enquiry.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowText}>
    <strong style={rowLabel}>{label}:</strong> {value}
  </Text>
)

export const template = {
  component: ContactEnquiryEmail,
  subject: (data: Record<string, any>) =>
    `[Ovasyt] ${data?.subject ?? 'New enquiry'} — ${data?.name ?? 'Website visitor'}`,
  to: 'info@ovasyt.tech',
  displayName: 'Contact form enquiry',
  previewData: {
    name: 'Jane Dube',
    email: 'jane@ngo.org.za',
    phone: '+27 82 123 4567',
    organisation: 'Sunrise Community Trust',
    subject: 'Book a demo',
    message: 'Hi team, we would love a walkthrough of the platform.',
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: '#0f172a', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }
const h2 = { color: '#0f172a', fontSize: '15px', fontWeight: 700, margin: '20px 0 8px' }
const intro = { color: '#475569', fontSize: '14px', lineHeight: '22px', margin: '0 0 20px' }
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px 18px',
}
const rowText = { color: '#0f172a', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const rowLabel = { color: '#64748b', fontWeight: 600 as const, marginRight: '6px' }
const messageBox = {
  color: '#0f172a',
  fontSize: '14px',
  lineHeight: '22px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '14px 16px',
  whiteSpace: 'pre-wrap' as const,
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }