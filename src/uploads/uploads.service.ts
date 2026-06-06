import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  private get bucket(): string { return this.config.get<string>('S3_BUCKET', ''); }
  private get region(): string { return this.config.get<string>('S3_REGION', 'us-east-1'); }
  private get accessKey(): string { return this.config.get<string>('AWS_ACCESS_KEY_ID', ''); }
  private get secretKey(): string { return this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''); }

  async getPresignedUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.bucket || !this.accessKey || !this.secretKey) {
      throw new BadRequestException('S3 upload not configured — set S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    }

    const { key, contentType, expiresInSeconds = 300 } = input;
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const dateShort = dateStr.substring(0, 8);
    const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const credentialScope = `${dateShort}/${this.region}/s3/aws4_request`;
    const credential = `${this.accessKey}/${credentialScope}`;

    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': dateStr,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'content-type;host',
    });
    const canonicalQueryString = params.toString();
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    const canonicalRequest = [
      'PUT',
      `/${key}`,
      canonicalQueryString,
      canonicalHeaders,
      'content-type;host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStr,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer, data: string) => crypto.createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(Buffer.from(`AWS4${this.secretKey}`), dateShort), this.region), 's3'),
      'aws4_request',
    );
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const uploadUrl = `https://${host}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const publicUrl = `https://${host}/${key}`;
    return { uploadUrl, publicUrl };
  }
}
