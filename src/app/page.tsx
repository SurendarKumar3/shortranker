"use client";

import Link from "next/link";
import { Trophy, Upload, Sparkles, Download, Play, ArrowRight, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <Trophy className="w-12 h-12 md:w-16 md:h-16 text-yellow-400" />
              <h1 className="text-5xl md:text-7xl font-bold text-white">
                ShortsRanker
              </h1>
            </div>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Create epic countdown videos in minutes. Upload 5 clips, rank them, 
              and let AI generate the perfect voice-over for your compilation.
            </p>

            <Link href="/shorts-ranker">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg px-8 py-6 rounded-full">
                Start Creating
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>

          {/* Demo Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16"
          >
            <div className="relative max-w-4xl mx-auto">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-400 text-sm ml-4">ShortsRanker Editor</span>
                </div>
                
                {/* Mock Video Grid */}
                <div className="grid grid-cols-5 gap-3">
                  {[5, 4, 3, 2, 1].map((rank) => (
                    <div key={rank} className="relative group">
                      <div className="aspect-[9/16] bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                        <Play className="w-8 h-8 text-gray-500" />
                      </div>
                      <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        rank === 1 ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black" :
                        rank === 2 ? "bg-gradient-to-r from-gray-300 to-gray-400 text-black" :
                        rank === 3 ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white" :
                        "bg-purple-500 text-white"
                      }`}>
                        #{rank}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            How It Works
          </h2>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                icon: Upload,
                title: "1. Upload",
                description: "Drop in exactly 5 vertical videos you want to rank",
                color: "text-blue-400",
              },
              {
                icon: Trophy,
                title: "2. Rank",
                description: "Drag and drop to order your clips from #5 to #1",
                color: "text-yellow-400",
              },
              {
                icon: Sparkles,
                title: "3. Generate",
                description: "AI creates a professional voice-over script",
                color: "text-purple-400",
              },
              {
                icon: Download,
                title: "4. Download",
                description: "Get your 1080x1920 vertical compilation MP4",
                color: "text-green-400",
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6 text-center hover:border-purple-500/50 transition-colors"
              >
                <feature.icon className={`w-12 h-12 mx-auto mb-4 ${feature.color}`} />
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-6">
            Perfect For
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Create engaging countdown content for any platform or niche
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Gaming Clips",
                description: "Rank your best plays, fails, or clutch moments",
                gradient: "from-red-500 to-orange-500",
              },
              {
                title: "Meme Compilations",
                description: "Curate the funniest clips of the week",
                gradient: "from-purple-500 to-pink-500",
              },
              {
                title: "Sports Highlights",
                description: "Showcase top goals, dunks, or touchdowns",
                gradient: "from-green-500 to-emerald-500",
              },
              {
                title: "Product Reviews",
                description: "Rank gadgets, beauty products, or foods",
                gradient: "from-blue-500 to-cyan-500",
              },
              {
                title: "Travel Moments",
                description: "Share your best destinations and adventures",
                gradient: "from-amber-500 to-yellow-500",
              },
              {
                title: "User Submissions",
                description: "Feature community content in ranked format",
                gradient: "from-indigo-500 to-violet-500",
              },
            ].map((useCase, index) => (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="bg-slate-800/30 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${useCase.gradient} flex items-center justify-center mb-4`}>
                  <Video className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{useCase.title}</h3>
                <p className="text-gray-400 text-sm">{useCase.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Create Your Countdown?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              No sign-up required. Start creating in seconds.
            </p>
            <Link href="/shorts-ranker">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg px-10 py-6 rounded-full">
                Launch ShortsRanker
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-semibold">ShortsRanker</span>
          </div>
          <p className="text-gray-500 text-sm">
            Create ranked video compilations with AI voice-overs
          </p>
        </div>
      </footer>
    </div>
  );
}