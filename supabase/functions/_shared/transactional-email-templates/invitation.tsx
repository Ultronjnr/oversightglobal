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

const roleLabels: Record<string, string> = {
  EMPLOYEE: 'Employee',
  HOD: 'Head of Department',
  FINANCE: 'Finance',
  ADMIN: 'Administrator',
  SUPPLIER: 'Supplier',
}

interface InvitationEmailProps {
  inviteLink: string
  role?: string
  department?: string
}

const InvitationEmail = ({ inviteLink, role, department }: InvitationEmailProps) => {
  const roleLabel = role ? roleLabels[role] || role : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've been invited to join {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You've been invited to {SITE_NAME}</Heading>
          <Text style={text}>
            You've been invited to join <strong>{SITE_NAME}</strong>
            {roleLabel ? (
              <>
                {' '}as a <strong>{roleLabel}</strong>
              </>
            ) : null}
            {department ? (
              <>
                {' '}in the <strong>{department}</strong> department
              </>
            ) : null}
            . Click the button below to accept the invitation and create your account.
          </Text>
          <Button style={button} href={inviteLink}>
            Accept Invitation
          </Button>
          <Text style={footer}>
            This invitation will expire in 7 days. If you weren't expecting this
            invitation, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InvitationEmail,
  subject: `You've been invited to join ${SITE_NAME}`,
  displayName: 'Team invitation',
  previewData: {
    inviteLink: 'https://ovasyt.tech/invite?token=sample',
    role: 'EMPLOYEE',
    department: 'Finance',
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
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#3b5fe1',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#9aa1ad', margin: '30px 0 0' }