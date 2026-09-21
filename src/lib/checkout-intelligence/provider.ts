// ==============================================================================
// OFFER MINER - CHECKOUT PROVIDER DETECTOR & DOM CONFIRMATOR
// ==============================================================================

import { CheckoutProvider } from './types';

export interface CheckoutDomSignals {
  hasBuyerForm: boolean;
  hasPaymentFields: boolean;
  hasOrderSummary: boolean;
  hasPrice: boolean;
  detectedProviderDomain: string | null;
  buyerFieldsCount: number;
  paymentKeywordsCount: number;
}

export function analyzeCheckoutDom(pageBodyText: string, pageTitle: string = ''): CheckoutDomSignals {
  const lowerBody = pageBodyText.toLowerCase();
  const lowerTitle = pageTitle.toLowerCase();

  // 1. Buyer Form Signals
  const buyerFieldTerms = ['cpf', 'cnpj', 'e-mail', 'email', 'nome completo', 'telefone', 'celular', 'endereço', 'cep'];
  let buyerFieldsCount = 0;
  buyerFieldTerms.forEach((term) => {
    if (lowerBody.includes(term)) buyerFieldsCount++;
  });
  const hasBuyerForm = buyerFieldsCount >= 2;

  // 2. Payment Method Signals
  const paymentTerms = ['pix', 'cartão de crédito', 'cartao', 'boleto', 'parcelamento', 'validade', 'cvv', 'cardholder'];
  let paymentKeywordsCount = 0;
  paymentTerms.forEach((term) => {
    if (lowerBody.includes(term)) paymentKeywordsCount++;
  });
  const hasPaymentFields = paymentKeywordsCount >= 2;

  // 3. Order Summary & Price Signals
  const hasOrderSummary = lowerBody.includes('resumo do pedido') || lowerBody.includes('total') || lowerBody.includes('subtotal') || lowerTitle.includes('checkout') || lowerTitle.includes('pagamento');
  const hasPrice = /(?:r\$|\+r\$)\s*\d+[\.,]\d{2}/i.test(lowerBody);

  return {
    hasBuyerForm,
    hasPaymentFields,
    hasOrderSummary,
    hasPrice,
    detectedProviderDomain: null,
    buyerFieldsCount,
    paymentKeywordsCount,
  };
}

export function detectCheckoutProvider(
  url: string,
  pageTitle: string = '',
  pageBodyText: string = ''
): {
  provider: CheckoutProvider | null;
  isConfirmedCheckout: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  domSignals: CheckoutDomSignals;
} {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    hostname = url.toLowerCase();
  }

  const domSignals = analyzeCheckoutDom(pageBodyText, pageTitle);

  // 1. Known Domain Matches
  if (hostname.includes('ggcheckout') || hostname.includes('ggcheckout.app')) {
    return { provider: 'GGCheckout', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('kiwify') || hostname.includes('pay.kiwify')) {
    return { provider: 'Kiwify', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('hotmart') || hostname.includes('pay.hotmart')) {
    return { provider: 'Hotmart', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('wiapy') || hostname.includes('pay.wiapy')) {
    return { provider: 'Wiapy', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('kirvano') || hostname.includes('checkout.kirvano')) {
    return { provider: 'Kirvano', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('perfectpay') || hostname.includes('checkout.perfectpay')) {
    return { provider: 'PerfectPay', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('eduzz') || hostname.includes('sun.eduzz')) {
    return { provider: 'Eduzz', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('monetizze') || hostname.includes('app.monetizze')) {
    return { provider: 'Monetizze', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('braip') || hostname.includes('ev.braip')) {
    return { provider: 'Braip', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('ticto') || hostname.includes('checkout.ticto')) {
    return { provider: 'Ticto', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('stripe') || hostname.includes('buy.stripe')) {
    return { provider: 'Stripe', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('cartpanda') || hostname.includes('checkout.cartpanda')) {
    return { provider: 'CartPanda', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('woocommerce') || pageBodyText.toLowerCase().includes('detalhes do faturamento')) {
    return { provider: 'WooCommerce', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }
  if (hostname.includes('myshopify.com') || hostname.includes('checkouts')) {
    return { provider: 'Shopify', isConfirmedCheckout: true, confidence: 'HIGH', domSignals };
  }

  // 2. DOM-based Confirmation for Unknown Domains
  const isConfirmedCheckout = (domSignals.hasBuyerForm && domSignals.hasPaymentFields) || (domSignals.hasPaymentFields && domSignals.hasOrderSummary);

  if (isConfirmedCheckout) {
    return {
      provider: 'Custom',
      isConfirmedCheckout: true,
      confidence: 'MEDIUM',
      domSignals,
    };
  }

  // If DOM lacks buyer or payment fields, do NOT classify as Custom!
  return {
    provider: null,
    isConfirmedCheckout: false,
    confidence: 'LOW',
    domSignals,
  };
}
