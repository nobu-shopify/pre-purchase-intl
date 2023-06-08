import React, { useEffect, useState } from "react";
import {
  render,
  Divider,
  Image,
  Banner,
  Heading,
  Button,
  InlineLayout,
  BlockStack,
  Text,
  SkeletonText,
  SkeletonImage,
  useCartLines,
  useApplyCartLinesChange,
  useExtensionApi,
  useCurrency,
  useLanguage,
} from "@shopify/checkout-ui-extensions-react";

// Set up the entry point for the extension
render("Checkout::Dynamic::Render", () => <App />);

// The function that will render the app
function App() {
  // Use `query` for fetching product data from the Storefront API, and use `i18n` to format
  // currencies, numbers, and translate strings
  const { query, i18n } = useExtensionApi();
  // Get a reference to the function that will apply changes to the cart lines from the imported hook
  const applyCartLinesChange = useApplyCartLinesChange();
  // Set up the states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showError, setShowError] = useState(false);

  // Get checkout currency & language
  const currency = useCurrency();
  const language = useLanguage();
  console.log("language", language);

  // Set appropriate country code for the Storefront API query
  // Below supports:
  // - EUR: Germany
  // - EUR: France
  // - CAD: Canada
  // - USD: United States
  const productCountry = (currency.isoCode === "EUR") ? 
    ( (language.isoCode === "fr-FR") ? "FR" : "DE") 
    : (currency.isoCode === "CAD") ? "CA"
    : "US";
    console.log("productCountry", productCountry);

  // On initial load, fetch the product variants
  useEffect(() => {
    // Set the loading state to show some UI if you're waiting
    setLoading(true);
    // Use `query` api method to send graphql queries to the Storefront API
    query(
      `query ($first: Int!) @inContext(country: ${productCountry}) {
        products(first: $first, query:"UPSELL") {
          nodes {
            id
            title
            images(first:1){
              nodes {
                url
              }
            }
            variants(first: 1) {
              nodes {
                id
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }`,
      {
        variables: {first: 5},
      },
    )
    .then(({data}) => {
      // Set the `products` array so that you can reference the array items
      setProducts(data.products.nodes);
    })
    .catch((error) => console.error(error))
    .finally(() => setLoading(false));
  }, []);

  // If an offer is added and an error occurs, then show some error feedback using a banner
  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  // Access the current cart lines and subscribe to changes
  const lines = useCartLines();

  // Show a loading UI if you're waiting for product variant data
  // Use Skeleton components to keep placement from shifting when content loads
  if (loading) {
    return (
      <BlockStack spacing="loose">
        <Divider />
        <Heading level={2}>You might also like</Heading>
        <BlockStack spacing="loose">
          <InlineLayout
            spacing="base"
            columns={[64, "fill", "auto"]}
            blockAlignment="center"
          >
            <SkeletonImage aspectRatio={1} />
            <BlockStack spacing="none">
              <SkeletonText inlineSize="large" />
              <SkeletonText inlineSize="small" />
            </BlockStack>
            <Button kind="secondary" disabled={true}>
              Add
            </Button>
          </InlineLayout>
        </BlockStack>
      </BlockStack>
    );
  }
  // If product variants can't be loaded, then show nothing
  if (!loading && products.length === 0) {
    return null;
  }

  // Get the IDs of all product variants in the cart
  const cartLineProductVariantIds = lines.map((item) => item.merchandise.id);
  // Filter out any products on offer that are already in the cart
  const productsOnOffer = products.filter(
    (product) => {
      const isProductVariantInCart = product.variants.nodes.some(
        ({id}) => cartLineProductVariantIds.includes(id)
      );
      return !isProductVariantInCart;
    }
  );

  // If all of the products are in the cart, then don't show the offer
  if (!productsOnOffer.length) {
    return null;
  }

  // Choose the first available product variant on offer
  const { images, title, variants } = productsOnOffer[0];

  // Localize the currency for international merchants and customers
  const renderPrice = i18n.formatCurrency(variants.nodes[0].price.amount);

  // TEST
  const renderUpsellTitle = i18n.translate("you_might_also_like");
  const renderAdd = i18n.translate("add");

  // Use the first product image or a placeholder if the product has no images
  const imageUrl = images.nodes[0]?.url
    ?? "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081";

  return (
    <BlockStack spacing="loose">
      <Divider />
      <Heading level={2}>{renderUpsellTitle}</Heading>
      <BlockStack spacing="loose">
        <InlineLayout
          spacing="base"
          // Use the `columns` property to set the width of the columns
          // Image: column should be 64px wide
          // BlockStack: column, which contains the title and price, should "fill" all available space
          // Button: column should "auto" size based on the intrinsic width of the elements
          columns={[64, "fill", "auto"]}
          blockAlignment="center"
        >
          <Image
            border="base"
            borderWidth="base"
            borderRadius="loose"
            source={imageUrl}
            description={title}
            aspectRatio={1}
          />
          <BlockStack spacing="none">
            <Text size="medium" emphasis="strong">
              {title}
            </Text>
            <Text appearance="subdued">{renderPrice}</Text>
          </BlockStack>
          <Button
            kind="secondary"
            loading={adding}
            accessibilityLabel={`Add ${title} to cart`}
            onPress={async () => {
              setAdding(true);
              // Apply the cart lines change
              const result = await applyCartLinesChange({
                type: "addCartLine",
                merchandiseId: variants.nodes[0].id,
                quantity: 1,
              });
              setAdding(false);
              if (result.type === "error") {
                // An error occurred adding the cart line
                // Verify that you're using a valid product variant ID
                // For example, 'gid://shopify/ProductVariant/123'
                setShowError(true);
                console.error(result.message);
              }
            }}
          >
            {renderAdd}
          </Button>
        </InlineLayout>
      </BlockStack>
      {showError && (
        <Banner status="critical">
          There was an issue adding this product. Please try again.
        </Banner>
      )}
    </BlockStack>
  );
}
