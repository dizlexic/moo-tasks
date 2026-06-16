import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail, resetTransporter } from '../mailer';
import nodemailer from 'nodemailer';

vi.mock('nodemailer');

describe('mailer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetTransporter();
    });

    it('should send an email successfully', async () => {
        const sendMailMock = vi.fn().mockResolvedValue({ messageId: '123' });
        vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
            sendMail: sendMailMock,
        } as any);

        const result = await sendEmail('test@example.com', 'Subject', 'Text', 'HTML');
        expect(result).toEqual({ success: true });
        expect(sendMailMock).toHaveBeenCalledWith({
            from: process.env.SMTP_FROM,
            to: 'test@example.com',
            subject: 'Subject',
            text: 'Text',
            html: 'HTML',
        });
    });

    it('should return failure if nodemailer fails', async () => {
        const error = new Error('SMTP Error');
        const sendMailMock = vi.fn().mockRejectedValue(error);
        vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
            sendMail: sendMailMock,
        } as any);

        const result = await sendEmail('test@example.com', 'Subject', 'Text');
        expect(result).toEqual({ success: false, error });
    });
});
