import { GITHUB_REPO } from "./auth.js";
import { githubHeaders } from "./github.js";

const GRAPHQL_URL = "https://api.github.com/graphql";

export async function githubGraphql(query, variables, env) {
  const headers = {
    ...githubHeaders(env),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload?.message || `GitHub GraphQL HTTP ${res.status}`;
    throw new Error(message);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
  return payload.data;
}

const OWNER_REPO = GITHUB_REPO.split("/");
const OWNER = OWNER_REPO[0];
const NAME = OWNER_REPO[1];

export async function fetchDiscussionCategories(env) {
  const data = await githubGraphql(
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
        discussionCategories(first: 25) {
          nodes {
            id
            name
            slug
            emoji
            description
            isAnswerable
          }
        }
      }
    }`,
    { owner: OWNER, name: NAME },
    env
  );
  const repo = data?.repository;
  return {
    repositoryId: repo?.id ?? null,
    categories: (repo?.discussionCategories?.nodes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      emoji: c.emoji ?? "",
      description: c.description ?? "",
      isAnswerable: Boolean(c.isAnswerable),
      format: c.isAnswerable
        ? "qa"
        : String(c.slug || "").includes("announce")
          ? "announcement"
          : "discussion",
    })),
  };
}

export async function createDiscussionPost(env, { repositoryId, categoryId, title, body }) {
  const data = await githubGraphql(
    `mutation($input: CreateDiscussionInput!) {
      createDiscussion(input: $input) {
        discussion { id url title }
      }
    }`,
    {
      input: {
        repositoryId,
        categoryId,
        title,
        body,
      },
    },
    env
  );
  return data?.createDiscussion?.discussion ?? null;
}

export function manageCategoriesUrl() {
  return `https://github.com/${GITHUB_REPO}/discussions/categories`;
}

export function discussionsHomeUrl() {
  return `https://github.com/${GITHUB_REPO}/discussions`;
}
