# nRouter Content Generator

A small local webpage for drafting blog posts, social posts, emails, product
descriptions, video scripts, ad copy, and documentation with nRouter.

The **nRouter blog automation** mode builds a complete brief from the canonical
Final Blog Post Prompt. Choose one of the five work types, enter the slug, search
intent, and publication date, then review the assembled prompt before generation.
The matching category and work-type module are added automatically, and completed
blog posts download as `.mdx` files.

## Run it

```bash
cd sdks/js/demo/content-generator
cp .env.example .env
# Put your nRouter virtual key in .env
npm start
```

Open `http://127.0.0.1:4318`.

The API key stays in the local server process and is never sent to the browser.
Email addresses in a content brief are replaced with private placeholders before
the model request and restored in the generated result. This prevents nRouter's
PreCall PII guardrail from receiving the address while keeping the guardrail on.
Building and editing the content brief is free. Clicking **Generate content**
sends one billed `POST /v1/chat/completions` request after confirmation. The
result includes the nRouter request ID, exact cost when priced, and token usage.

## Verify without credits

```bash
npm test
```

The self-test validates the prompt builder, email protection, response parser,
and cost parsing without using an API key or contacting nRouter.
