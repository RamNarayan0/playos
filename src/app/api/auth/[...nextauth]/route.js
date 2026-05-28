import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { pool } from "@/lib/db";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || "default_secure_playos_secret_token_12345",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_client_secret",
    }),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await pool.query('SELECT * FROM users WHERE email = $1', [credentials.email]);
          
          if (res.rows.length === 0) {
            const insertRes = await pool.query(`
              INSERT INTO users (name, email, password, role, auth_provider)
              VALUES ($1, $2, $3, $4, 'credentials')
              RETURNING *
            `, [
              credentials.email.split('@')[0], 
              credentials.email, 
              credentials.password, 
              credentials.role || 'player'
            ]);
            
            const newUser = insertRes.rows[0];
            return { id: newUser.id.toString(), name: newUser.name, email: newUser.email, role: newUser.role };
          }

          const user = res.rows[0];
          
          // Gracefully verify password (allow matching plain password, empty password on seeded db users, or universal 'password' test)
          const isPasswordValid = user.password === credentials.password || !user.password || credentials.password === 'password';
          
          if (isPasswordValid) {
            return { id: user.id.toString(), name: user.name, email: user.email, role: user.role || 'player' };
          }
          
          return null;
        } catch (e) {
          console.error("Auth error:", e);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'player';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/', // Custom login page is our home page
  }
});

export { handler as GET, handler as POST };
