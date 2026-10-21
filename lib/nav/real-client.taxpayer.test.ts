/** @jest-environment node */
import { createNavRealClient } from "@/lib/nav/real-client";

const CREDS = { login: "l", password: "p", signKey: "s", exchangeKey: "e", taxNumber: "99999999", environment: "production", source: "shared" } as const;

const RESPONSE = `<QueryTaxpayerResponse><result><funcCode>OK</funcCode></result>
<taxpayerValidity>true</taxpayerValidity>
<taxpayerData><taxpayerName>Duna Kft.</taxpayerName>
<taxNumberDetail><base:taxpayerId>12345678</base:taxpayerId><base:vatCode>2</base:vatCode><base:countyCode>41</base:countyCode></taxNumberDetail>
<taxpayerAddressList><taxpayerAddressItem><taxpayerAddress><base:countryCode>HU</base:countryCode><base:postalCode>1051</base:postalCode><base:city>Budapest</base:city><base:streetName>Október 6.</base:streetName></taxpayerAddress></taxpayerAddressItem></taxpayerAddressList>
</taxpayerData></QueryTaxpayerResponse>`;

describe("real client queryTaxpayer", () => {
  const saved = process.env.NAV_SOFTWARE_ID;
  beforeEach(() => {
    process.env.NAV_SOFTWARE_ID = "ABCDEFGHIJ1234567X";
    global.fetch = jest.fn().mockResolvedValue({ status: 200, text: async () => RESPONSE }) as unknown as typeof fetch;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.NAV_SOFTWARE_ID;
    else process.env.NAV_SOFTWARE_ID = saved;
  });

  it("returns the VAT and county codes so the caller can build the full adószám", async () => {
    const result = await createNavRealClient("test").queryTaxpayer(CREDS, "12345678");
    expect(result).toMatchObject({ valid: true, name: "Duna Kft.", vatCode: "2", countyCode: "41", city: "Budapest", zipCode: "1051" });
  });
});
