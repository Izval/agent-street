import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("aisle/:id", "routes/aisle.tsx"),
  route("category/:id", "routes/category.tsx"),
  route("agent/:id", "routes/agent.tsx"),
  route("skills", "routes/skills.tsx"),
  route("skill/:id", "routes/skill.tsx"),
  route("hire", "routes/hire.tsx"),
  route("create", "routes/create.tsx"),
  route("me", "routes/me.tsx"),
  route("saved", "routes/saved.tsx"),
  route("search", "routes/search.tsx"),
  route("for-agents", "routes/for-agents.tsx"),
] satisfies RouteConfig;
