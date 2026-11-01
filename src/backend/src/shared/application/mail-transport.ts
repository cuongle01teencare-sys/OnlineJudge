export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Port: delivers an email. */
export abstract class MailTransport {
  abstract send(message: MailMessage): Promise<void>;
}
