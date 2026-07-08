/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Ovasyt'

interface DonationReceiptEmailProps {
  donorName?: string
  receiptNumber?: string
  downloadUrl?: string
  verifyUrl?: string
}

const DonationReceiptEmail = ({
  donorName,
  receiptNumber,
  downloadUrl,
  verifyUrl,
}: DonationReceiptEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Section 18A tax receipt {receiptNumber || ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your Section 18A Tax Receipt</Heading>
        <Text style={text}>
          {donorName ? `Dear ${donorName},` : 'Hello,'}
        </Text>
        <Text style={text}>
          Thank you for your generous donation. Your Section 18A tax receipt
          {receiptNumber ? <> (<strong>{receiptNumber}</strong>)</> : null} is
          ready. You can download it using the secure link below.
        </Text>
        {downloadUrl ? (
          <Button style={button} href={downloadUrl}>
            Download Receipt
          </Button>
        ) : null}
        {verifyUrl ? (
          <Text style={text}>
            You can verify the authenticity of this receipt at any time here:{' '}
            <Link href={verifyUrl}>{verifyUrl}</Link>
          </Text>
        ) : null}
        <Text style={footer}>
          This receipt is issued in terms of Section 18A of the Income Tax Act.
          The download link is valid for a limited time. Sent by {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DonationReceiptEmail,
  subject: (data: Record<string, any>) =>
    `Your Section 18A Tax Receipt${data?.receiptNumber ? ` ${data.receiptNumber}` : ''}`,
  displayName: 'Donation receipt',
  previewData: {
    donorName: 'Jane Donor',
    receiptNumber: '18A-2026-0001',
    downloadUrl: 'https://example.com/receipt.pdf',
    verifyUrl: 'https://ovasyt.tech/verify/receipt/sample',
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