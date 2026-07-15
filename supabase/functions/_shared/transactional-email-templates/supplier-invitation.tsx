/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Ovasyt'

interface SupplierInvitationEmailProps {
  contactPerson?: string
  companyName?: string
  registrationUrl: string
  reminder?: 'reminder' | 'expiry' | null
}

const SupplierInvitationEmail = ({
  contactPerson,
  companyName,
  registrationUrl,
  reminder,
}: SupplierInvitationEmailProps) => {
  const heading =
    reminder === 'expiry'
      ? 'Your Ovasyt Supplier Invitation Expires Soon'
      : reminder === 'reminder'
        ? 'Reminder: Complete your Supplier Registration'
        : "You're Invited to Join Ovasyt Supplier Portal"

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>Hello {contactPerson || 'there'},</Text>
          <Text style={text}>
            <strong>{companyName || 'Your company'}</strong> has been invited to
            join the Ovasyt Supplier Network. Click the button below to
            complete your registration.
          </Text>
          <Button style={button} href={registrationUrl}>
            Complete Registration
          </Button>
          <Text style={text}>The invitation expires in 7 days.</Text>
          <Text style={footer}>
            If you were not expecting this invitation, please ignore this email.
          </Text>
          <Text style={footer}>
            Regards,
            <br />
            {SITE_NAME} Procurement Team
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupplierInvitationEmail,
  subject: (data: Record<string, any>) =>
    data?.reminder === 'expiry'
      ? 'Your Ovasyt Supplier Invitation Expires Soon'
      : data?.reminder === 'reminder'
        ? 'Reminder: Complete your Supplier Registration'
        : "You're Invited to Join Ovasyt Supplier Portal",
  displayName: 'Supplier invitation',
  previewData: {
    contactPerson: 'Jane Doe',
    companyName: 'ABC Supplies Ltd',
    registrationUrl: 'https://ovasyt.tech/supplier/register?token=sample',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '480px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#67707f',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const button = {
  backgroundColor: '#3b5fe1',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 0 18px',
}
const footer = { fontSize: '12px', color: '#9aa1ad', margin: '12px 0 0' }