# DNS Verification for VS Code Marketplace Publisher

This document explains how to verify the `LorapokLabs` publisher ownership via DNS TXT record.

## Verification Details

- **Hostname**: `_visual-studio-marketplace-lorapoklabs.lorapok.tech`
- **TXT Record Value**: `17df4b30-8742-48c2-a8f0-3520e228da15`
- **Domain**: `lorapok.tech`

## Step-by-Step Instructions

### 1. Access Your DNS Provider

Log in to your domain registrar or DNS provider where `lorapok.tech` is hosted. Common providers include:
- Cloudflare
- GoDaddy
- Namecheap
- Google Domains
- AWS Route 53
- Azure DNS

### 2. Navigate to DNS Management

Find the DNS management or DNS settings section for your domain.

### 3. Add the TXT Record

Create a new TXT record with the following values:

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Host/Name** | `_visual-studio-marketplace-lorapoklabs` |
| **Value** | `17df4b30-8742-48c2-a8f0-3520e228da15` |
| **TTL** | 3600 (or default) |

**Important Notes:**
- The hostname should be `_visual-studio-marketplace-lorapoklabs.lorapok.tech`
- Some providers require you to enter only the subdomain part: `_visual-studio-marketplace-lorapoklabs`
- The provider automatically appends your domain name
- Do not include quotes around the TXT value unless your provider requires it

### 4. Save Changes

Save the DNS configuration changes.

### 5. Wait for Propagation

DNS changes can take up to 72 hours to propagate worldwide, though typically it takes 5-30 minutes.

### 6. Verify the Record

You can verify the TXT record is active using:

**Using dig (Linux/Mac):**
```bash
dig TXT _visual-studio-marketplace-lorapoklabs.lorapok.tech
```

**Using nslookup (Windows):**
```cmd
nslookup -type=TXT _visual-studio-marketplace-lorapoklabs.lorapok.tech
```

**Using online tools:**
- https://mxtoolbox.com/TXTLookup.aspx
- https://www.whatsmydns.net/

### 7. Complete Verification in VS Code Marketplace

1. Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
2. Select your publisher: `LorapokLabs`
3. Navigate to the verification section
4. Click "Verify" or "Verify Domain"
5. The system will check for the TXT record
6. Once verified, your publisher ownership will be confirmed

## Troubleshooting

### Record Not Found
- Double-check the hostname spelling
- Ensure you didn't include the full domain in the host field if your provider auto-appends it
- Wait at least 30 minutes for DNS propagation

### Verification Fails
- Ensure the TXT value is exactly: `17df4b30-8742-48c2-a8f0-3520e228da15`
- Check for extra spaces or quotes
- Verify the record type is TXT (not CNAME or other types)

### Provider-Specific Instructions

#### Cloudflare
1. Go to DNS → Records
2. Add record → Type: TXT
3. Name: `_visual-studio-marketplace-lorapoklabs`
4. Content: `17df4b30-8742-48c2-a8f0-3520e228da15`
5. TTL: Auto or 3600
6. Save

#### GoDaddy
1. Go to DNS Management
2. Add TXT record
3. Host: `_visual-studio-marketplace-lorapoklabs`
4. TXT Value: `17df4b30-8742-48c2-a8f0-3520e228da15`
5. TTL: 1 hour
6. Save

#### AWS Route 53
1. Go to Hosted Zones
2. Select `lorapok.tech`
3. Create Record Set
4. Name: `_visual-studio-marketplace-lorapoklabs`
5. Type: TXT
6. Value: `17df4b30-8742-48c2-a8f0-3520e228da15`
7. Create

## After Verification

Once verified:
- Your `LorapokLabs` publisher will be fully activated
- You can publish extensions to VS Code Marketplace
- The CI/CD workflow will use the `VSCE_PAT` secret to publish automatically

## Related Documentation

- [MARKETPLACE_PUBLISHING.md](./MARKETPLACE_PUBLISHING.md) - Complete marketplace publishing guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - CI/CD deployment guide
