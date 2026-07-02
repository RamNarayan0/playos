"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, LogOut, Users, PlusCircle, CheckCircle, Clock, MapPin, Shield, UserCheck, Award, Bell, Sparkles, Camera, Navigation2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import io from "socket.io-client";

export default function PlayerDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("join"); // join, create, manage
  const socketRef = useRef(null);

  // Chat State
  const [activeChatMatch, setActiveChatMatch] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const [matches, setMatches] = useState([]);
  const [recommendedMatches, setRecommendedMatches] = useState([]);
  const [turfs, setTurfs] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  // Use real user ID from session
  const currentUserId = session?.user?.id ? parseInt(session.user.id) : null;
  const currentUserName = session?.user?.name || "Player";

  // Geolocation state
  const [userLocation, setUserLocation] = useState(null);

  // Profile & Reputation State
  const [userProfile, setUserProfile] = useState(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('detecting'); // detecting, active, denied, error

  // Create Team Form State
  const [formData, setFormData] = useState({
    name: "",
    size: "",
    turf_id: "",
    date: "",
    time: "",
    skill: "Any Skill Level",
    phone: ""
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("All");

  // Turf Booking State
  const [selectedMatchForBooking, setSelectedMatchForBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [turfSearchQuery, setTurfSearchQuery] = useState("");

  const filteredMatches = matches
    .filter(m => m.host_id !== currentUserId)
    .filter(m => {
      const query = searchQuery.toLowerCase();
      const matchesQuery = 
        m.name.toLowerCase().includes(query) ||
        (m.host_name && m.host_name.toLowerCase().includes(query)) ||
        (m.turf_name && m.turf_name.toLowerCase().includes(query));
      const matchesSkill = skillFilter === "All" || m.skill_level === skillFilter;
      return matchesQuery && matchesSkill;
    });

  const joinedTeams = matches.filter(m => m.players && m.players.some(p => p.id === currentUserId));

  const fetchUserProfile = async (id) => {
    try {
      const res = await fetch(`/api/user/profile?user_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateProfilePreferences = async (sports, skill) => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, preferred_sports: sports, skill_level: skill })
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
        alert('Profile preferences updated successfully!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executePushSubscription = async () => {
    setShowPushModal(false);
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported by your browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permission denied. You can enable them in site settings.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Unsubscribe existing if needed or get directly
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIsqP93bLezXwgG8g';
        
        // Convert VAPID key to Uint8Array
        const padding = '='.repeat((4 - publicVapidKey.length % 4) % 4);
        const base64 = (publicVapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
      }

      // Save to database
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, subscription })
      });

      if (res.ok) {
        setPushSubscribed(true);
        alert('Push notifications activated! You will receive match update alerts.');
      }
    } catch (e) {
      console.error('Failed to subscribe to push notifications:', e);
    }
  };

  const fetchIncomingRequests = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/requests?host_id=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data);
      }
    } catch (e) {
      console.error("Error fetching incoming requests:", e);
    }
  };

  const fetchMySentRequests = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/requests?user_id=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data);
      }
    } catch (e) {
      console.error("Error fetching sent requests:", e);
    }
  };

  const fetchMatches = async (location = null) => {
    try {
      let url = "/api/matches";
      if (location) {
        url += `?lat=${location.lat}&lng=${location.lng}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
        // Split into myTeams and others if needed
        setMyTeams(data.filter(m => m.host_id === currentUserId));
        fetchIncomingRequests();
        fetchMySentRequests();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecommendations = async (location = null) => {
    try {
      let url = "/api/recommendations";
      if (currentUserId) {
        url += `?user_id=${currentUserId}`;
      }
      if (location) {
        url += `${currentUserId ? '&' : '?'}lat=${location.lat}&lng=${location.lng}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecommendedMatches(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTurfs = async () => {
    try {
      const res = await fetch("/api/turfs");
      if (res.ok) {
        const data = await res.json();
        setTurfs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  useEffect(() => {
    // Initialize Socket.io
    const newSocket = io({
      query: { userId: currentUserId }
    });
    socketRef.current = newSocket;

    newSocket.on("match_updated", (updatedMatch) => {
      setMatches((prev) => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
    });

    newSocket.on("receive_message", (message) => {
      setChatMessages((prev) => [...prev, message]);
    });

    // Run UI state updates and API fetches asynchronously to satisfy react-hooks/set-state-in-effect lint rule
    setTimeout(() => {
      // Live Browser Geolocation API Integration
      if (navigator.geolocation) {
        setLocationStatus('detecting');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const liveLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(liveLocation);
            setLocationStatus('active');
            fetchMatches(liveLocation);
            fetchRecommendations(liveLocation);
          },
          (error) => {
            console.warn('Geolocation access denied or unavailable:', error.message);
            // Fallback to default coordinates if permission denied
            const fallbackLocation = { lat: 17.385, lng: 78.4867 }; // Hyderabad default
            setUserLocation(fallbackLocation);
            setLocationStatus(error.code === 1 ? 'denied' : 'error');
            fetchMatches(fallbackLocation);
            fetchRecommendations(fallbackLocation);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        const fallbackLocation = { lat: 17.385, lng: 78.4867 };
        setUserLocation(fallbackLocation);
        setLocationStatus('error');
        fetchMatches(fallbackLocation);
        fetchRecommendations(fallbackLocation);
      }

      fetchTurfs();
      if (currentUserId) {
        fetchUserProfile(currentUserId);
      }
    }, 0);

    return () => newSocket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.time) {
      alert("Please select both a valid date and time.");
      return;
    }
    try {
      // Combine date and time for PostgreSQL timestamp
      const start_time = `${formData.date}T${formData.time}:00Z`;
      
      const payload = {
        name: formData.name,
        turf_id: formData.turf_id ? parseInt(formData.turf_id) : null,
        host_id: currentUserId,
        start_time: start_time,
        total_players: parseInt(formData.size),
        skill_level: formData.skill
      };

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormData({ name: "", size: "", turf_id: "", date: "", time: "", skill: "Any Skill Level", phone: "" });
        fetchMatches(userLocation);
        setActiveTab("manage");
      }
    } catch (e) {
      console.error("Failed to create match", e);
    }
  };

  const handleOpenBookingModal = (team) => {
    setSelectedMatchForBooking(team);
    setShowBookingModal(true);
  };

  const handleBookTurf = async (turfId) => {
    if (!selectedMatchForBooking) return;
    try {
      const res = await fetch("/api/matches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: selectedMatchForBooking.id,
          turf_id: turfId
        })
      });
      
      if (res.ok) {
        const updatedMatch = await res.json();
        
        // Update matches local state
        setMatches(prev => prev.map(m => m.id === updatedMatch.id ? { ...m, turf_id: updatedMatch.turf_id, turf_name: turfs.find(t => t.id === turfId)?.name || 'Booked Turf' } : m));
        
        // Update myTeams local state
        setMyTeams(prev => prev.map(m => m.id === updatedMatch.id ? { ...m, turf_id: updatedMatch.turf_id, turf_name: turfs.find(t => t.id === turfId)?.name || 'Booked Turf' } : m));
        
        // Close modal
        setShowBookingModal(false);
        setSelectedMatchForBooking(null);
        alert("Turf booked and assigned successfully!");
        
        // Notify other clients via socket
        if (socketRef.current) {
          socketRef.current.emit("request_accepted", { matchId: updatedMatch.id, userId: currentUserId });
        }
      } else {
        alert("Failed to book turf.");
      }
    } catch (e) {
      console.error("Booking error:", e);
      alert("Error booking turf.");
    }
  };

  const handleRequestJoin = async (match) => {
    if (myRequests.includes(match.id)) return;
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: match.id, user_id: currentUserId })
      });
      if (res.ok) {
        setMyRequests([...myRequests, match.id]);
        alert(`Request sent to join ${match.name}! Waiting for creator to accept.`);
        if (socketRef.current) socketRef.current.emit("send_request", { matchId: match.id, userId: currentUserId });
      } else {
        alert("Failed to send request. You may have already requested.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await fetch("/api/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, status: "ACCEPTED" })
      });
      if (res.ok) {
        alert("Request accepted!");
        fetchIncomingRequests();
        fetchMatches(userLocation);
        if (socketRef.current) {
          socketRef.current.emit("request_accepted", { userId: currentUserId });
        }
      }
    } catch (e) {
      console.error("Error accepting request:", e);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const res = await fetch("/api/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, status: "REJECTED" })
      });
      if (res.ok) {
        alert("Request rejected.");
        fetchIncomingRequests();
      }
    } catch (e) {
      console.error("Error rejecting request:", e);
    }
  };

  const openChat = async (match) => {
    setActiveChatMatch(match);
    if (socketRef.current) socketRef.current.emit("join_match_room", { matchId: match.id });
    
    // Fetch history
    try {
      const res = await fetch(`/api/messages?match_id=${match.id}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const closeChat = () => {
    if (socketRef.current && activeChatMatch) {
      socketRef.current.emit("leave_match_room", { matchId: activeChatMatch.id });
    }
    setActiveChatMatch(null);
    setChatMessages([]);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatMatch || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      matchId: activeChatMatch.id,
      userId: currentUserId,
      content: newMessage
    });
    setNewMessage("");
  };

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <>
      <nav className="navbar">
        <div className="container navbar-content">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.05)", padding: "0.5rem 1rem", borderRadius: "99px", border: "1px solid var(--border-color)" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>{currentUserName}</span>
            </div>

            <div className="navbar-logo" style={{ marginLeft: "1rem", paddingLeft: "1rem", borderLeft: "1px solid var(--border-color)" }}>
              <Zap size={24} color="var(--primary)" />
              PLAYOS <span style={{ fontSize: "1rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>| Player</span>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={handleSignOut} style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </nav>

      {/* Live Location Status Banner */}
      <div style={{ 
        position: "fixed", top: "72px", left: 0, right: 0, zIndex: 99,
        padding: "0.5rem 1.5rem",
        background: locationStatus === 'active' ? 'rgba(0, 229, 155, 0.1)' : locationStatus === 'denied' ? 'rgba(255, 75, 75, 0.1)' : 'rgba(255, 255, 255, 0.05)',
        borderBottom: `1px solid ${locationStatus === 'active' ? 'rgba(0, 229, 155, 0.2)' : locationStatus === 'denied' ? 'rgba(255, 75, 75, 0.2)' : 'var(--border-color)'}`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
        fontSize: "0.8rem", backdropFilter: "blur(12px)"
      }}>
        {locationStatus === 'detecting' && (
          <><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f5a623", animation: "pulse 1.5s infinite" }} /><span style={{ color: "var(--text-muted)" }}>Detecting your live location...</span></>
        )}
        {locationStatus === 'active' && (
          <><Navigation2 size={14} color="var(--primary)" /><span style={{ color: "var(--primary)" }}>📍 Live location active — showing nearby matches within 25km</span></>
        )}
        {locationStatus === 'denied' && (
          <><MapPin size={14} color="var(--error)" /><span style={{ color: "var(--error)" }}>Location access denied — using default city coordinates. <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }} style={{ color: "var(--primary)", textDecoration: "underline" }}>Retry</a></span></>
        )}
        {locationStatus === 'error' && (
          <><MapPin size={14} color="var(--text-muted)" /><span style={{ color: "var(--text-muted)" }}>Geolocation unavailable — using default coordinates</span></>
        )}
      </div>

      <main className="container hero" style={{ paddingTop: "130px", minHeight: "calc(100vh - 72px)" }}>
        
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`} onClick={() => setActiveTab('join')}>
            <Users size={18} /> Join a Team
          </button>
          <button className={`tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`} onClick={() => setActiveTab('recommendations')}>
            <Sparkles size={18} /> Smart Match Feed
          </button>
          <button className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
            <PlusCircle size={18} /> Create a Team
          </button>
          <button className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>
            <Shield size={18} /> My Teams & Requests
          </button>
          <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <Award size={18} /> My Profile
          </button>
        </div>

        <div className="tab-content" style={{ width: "100%", maxWidth: "800px", marginTop: "2rem" }}>
          
          {/* JOIN A TEAM TAB */}
          {activeTab === 'join' && (
            <div className="match-list">
              <h2 style={{ marginBottom: "1rem" }}>Available Teams</h2>
              
              {/* Search and Filters */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "1.5rem" }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search matches, hosts, or turfs..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
                <select 
                  className="form-input" 
                  value={skillFilter} 
                  onChange={e => setSkillFilter(e.target.value)}
                  style={{ marginBottom: 0, width: "180px", cursor: "pointer" }}
                >
                  <option value="All">All Skill Levels</option>
                  <option value="Beginner Friendly">Beginner Friendly</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced/Pro">Advanced/Pro</option>
                </select>
              </div>

              {filteredMatches.map(match => {
                const { date, time } = formatDateTime(match.start_time);
                return (
                  <div key={match.id} className="card match-card" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div>
                        <h3 style={{ fontSize: "1.25rem", color: "var(--primary)" }}>{match.name}</h3>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Created by {match.host_name}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                        <div className="badge badge-green">{match.skill_level}</div>
                        {match.distance_meters != null && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                            📍 {(match.distance_meters / 1000).toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Users size={16} color="var(--text-muted)" />
                        <span>Players Needed: <span className="players-needed">{match.players_needed}</span></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--text-muted)" />
                        <span>{match.turf_name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Clock size={16} color="var(--text-muted)" />
                        <span>{date} at {time}</span>
                      </div>
                    </div>

                    {(() => {
                      const request = myRequests.find(r => r.match_id === match.id);
                      if (!request) {
                        return (
                          <button 
                            className="btn btn-primary" 
                            style={{ width: "100%" }}
                            onClick={() => handleRequestJoin(match)}
                            disabled={match.players_needed === 0}
                          >
                            {match.players_needed === 0 ? "Team Full" : "Send Request to Join"}
                          </button>
                        );
                      }
                      if (request.status === 'PENDING') {
                        return (
                          <button className="btn btn-secondary" style={{ width: "100%" }} disabled>
                            Request Pending...
                          </button>
                        );
                      }
                      if (request.status === 'ACCEPTED') {
                        return (
                          <button className="btn" style={{ width: "100%", background: "rgba(0, 229, 155, 0.15)", color: "var(--primary)", border: "1px solid rgba(0, 229, 155, 0.3)", cursor: "default" }} disabled>
                            ✓ Joined Team
                          </button>
                        );
                      }
                      if (request.status === 'REJECTED') {
                        return (
                          <button className="btn" style={{ width: "100%", background: "rgba(255, 75, 75, 0.15)", color: "var(--error)", border: "1px solid rgba(255, 75, 75, 0.3)", cursor: "default" }} disabled>
                            Request Declined
                          </button>
                        );
                      }
                    })()}
                  </div>
                )
              })}
              {filteredMatches.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <p style={{ color: "var(--text-muted)" }}>
                    {matches.filter(m => m.host_id !== currentUserId).length === 0
                      ? "No teams available right now. Be the first to create one!"
                      : "No matches match your search criteria."
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SMART RECOMMENDATIONS FEED TAB */}
          {activeTab === 'recommendations' && (
            <div className="match-list">
              
              <div className="card" style={{ background: "linear-gradient(135deg, rgba(0, 229, 155, 0.1), rgba(0,0,0,0.4))", border: "1px solid var(--primary)", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <Sparkles size={20} color="var(--primary)" />
                  <h3 style={{ margin: 0, color: "var(--primary)" }}>Intelligent Roster Orchestration</h3>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>
                  Surfaced dynamically using location multi-variable calculus, verified skill tier alignment, and active marketplace completion urgency.
                </p>
              </div>

              {recommendedMatches.filter(m => m.host_id !== currentUserId).map(match => {
                const { date, time } = formatDateTime(match.start_time);
                const score = match.compatibility_score || 90;
                
                // Color formatting for intelligence confidence gauges
                let gaugeColor = "#00e59b"; // premium green
                if (score < 80) gaugeColor = "#f5a623"; // warning gold

                return (
                  <div key={match.id} className="card match-card" style={{ display: "block", position: "relative", overflow: "hidden" }}>
                    
                    {/* Top Confidence Score Banner Bar */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: `linear-gradient(90deg, ${gaugeColor} ${score}%, transparent ${score}%)` }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", marginTop: "0.25rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                          <h3 style={{ fontSize: "1.25rem", color: "var(--text-main)", margin: 0 }}>{match.name}</h3>
                          <span style={{ fontSize: "0.75rem", background: "rgba(0, 229, 155, 0.15)", color: "var(--primary)", padding: "0.15rem 0.5rem", borderRadius: "99px", fontWeight: "bold" }}>
                            {match.compatibility_label}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Hosted by {match.host_name}</p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: gaugeColor }}>{score}%</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "0.25rem" }}>Match</span>
                        </div>
                        {match.distance_meters != null && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            📍 {(match.distance_meters / 1000).toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Users size={16} color="var(--primary)" />
                        <span>Needed: <span style={{ fontWeight: "bold", color: "var(--primary)" }}>{match.players_needed}</span></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Shield size={16} color="var(--text-muted)" />
                        <span>Tier: <span style={{ color: "var(--text-main)" }}>{match.skill_level}</span></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--text-muted)" />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{match.turf_name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Clock size={16} color="var(--text-muted)" />
                        <span>{date} ({time})</span>
                      </div>
                    </div>

                    {(() => {
                      const request = myRequests.find(r => r.match_id === match.id);
                      if (!request) {
                        return (
                          <button 
                            className="btn btn-primary" 
                            style={{ width: "100%" }}
                            onClick={() => handleRequestJoin(match)}
                            disabled={match.players_needed === 0}
                          >
                            {match.players_needed === 0 ? "Team Full" : "Instant Algorithmic Join"}
                          </button>
                        );
                      }
                      if (request.status === 'PENDING') {
                        return (
                          <button className="btn btn-secondary" style={{ width: "100%" }} disabled>
                            Fulfillment Request Active
                          </button>
                        );
                      }
                      if (request.status === 'ACCEPTED') {
                        return (
                          <button className="btn" style={{ width: "100%", background: "rgba(0, 229, 155, 0.15)", color: "var(--primary)", border: "1px solid rgba(0, 229, 155, 0.3)", cursor: "default" }} disabled>
                            ✓ Joined Team
                          </button>
                        );
                      }
                      if (request.status === 'REJECTED') {
                        return (
                          <button className="btn" style={{ width: "100%", background: "rgba(255, 75, 75, 0.15)", color: "var(--error)", border: "1px solid rgba(255, 75, 75, 0.3)", cursor: "default" }} disabled>
                            Request Declined
                          </button>
                        );
                      }
                    })()}
                  </div>
                )
              })}

              {recommendedMatches.filter(m => m.host_id !== currentUserId).length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <p style={{ color: "var(--text-muted)" }}>No high-urgency smart matches match your specific target tier right now.</p>
                </div>
              )}

            </div>
          )}

          {/* CREATE A TEAM TAB */}
          {activeTab === 'create' && (
            <div className="card">
              <h2 style={{ marginBottom: "1.5rem", color: "var(--primary)" }}>Create a New Team</h2>
              <form onSubmit={handleCreateTeam} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Team Name</label>
                  <input type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Downtown Strikers" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Total Team Size</label>
                    <input type="number" className="form-input" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} required placeholder="e.g. 11" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Skill Level</label>
                    <select className="form-input" value={formData.skill} onChange={e => setFormData({...formData, skill: e.target.value})}>
                      <option>Any Skill Level</option>
                      <option>Beginner Friendly</option>
                      <option>Intermediate</option>
                      <option>Advanced/Pro</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Location (Turf / Venue)</label>
                  <select className="form-input" value={formData.turf_id} onChange={e => setFormData({...formData, turf_id: e.target.value})}>
                    <option value="">Decide Later (Search & Book Turf After Group Creation)</option>
                    {turfs.map(turf => (
                      <option key={turf.id} value={turf.id}>{turf.name} ({turf.location})</option>
                    ))}
                  </select>
                </div>

                {/* Live Google Maps Preview */}
                {userLocation && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Your Live Location Map</label>
                    <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-color)", height: "220px" }}>
                      <iframe
                        width="100%"
                        height="220"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8'}&q=${userLocation.lat},${userLocation.lng}&zoom=14&maptype=roadmap`}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <Navigation2 size={12} color="var(--primary)" />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {locationStatus === 'active' 
                          ? `Live GPS: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                          : `Default: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                        }
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Time</label>
                    <input type="time" className="form-input" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Your Contact Number</label>
                  <input type="tel" className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required placeholder="+1 234 567 890" />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    {"Hidden until you accept a player's request."}
                  </span>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                  Publish Team to Feed
                </button>
              </form>
            </div>
          )}

          {/* MANAGE TEAMS TAB */}
          {activeTab === 'manage' && (
            <div>
              <h2 style={{ marginBottom: "1rem" }}>Teams You Created</h2>
              {myTeams.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <Shield size={48} color="var(--text-muted)" style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                  <p style={{ color: "var(--text-muted)" }}>{"You haven't created any teams yet."}</p>
                  <button className="btn btn-secondary" style={{ marginTop: "1rem" }} onClick={() => setActiveTab('create')}>
                    Create Your First Team
                  </button>
                </div>
              ) : (
                <div className="match-list">
                  {myTeams.map(team => {
                    const { date, time } = formatDateTime(team.start_time);
                    return (
                      <div key={team.id} className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                          <div>
                            <h3>{team.name} <span style={{ fontSize: "0.875rem", fontWeight: "normal", color: "var(--text-muted)" }}>({date} @ {team.turf_name || "TBD"})</span></h3>
                          </div>
                          {!team.turf_id && (
                            <span className="badge" style={{ background: "rgba(255, 171, 0, 0.15)", color: "rgb(255, 171, 0)", border: "1px solid rgba(255, 171, 0, 0.3)" }}>
                              📍 No Turf Booked
                            </span>
                          )}
                        </div>
                        
                        <div style={{ marginBottom: "1.5rem" }}>
                          <h4 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Pending Requests ({incomingRequests.filter(r => r.match_id === team.id).length})
                          </h4>
                          {incomingRequests.filter(r => r.match_id === team.id).length === 0 ? (
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No pending requests.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              {incomingRequests.filter(r => r.match_id === team.id).map(req => (
                                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                                  <div>
                                    <span style={{ fontWeight: "bold" }}>{req.user_name}</span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>⭐ {req.reputation_score} Rep</span>
                                  </div>
                                  <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }} onClick={() => handleAcceptRequest(req.id)}>
                                      Accept
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }} onClick={() => handleRejectRequest(req.id)}>
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: "1rem" }}>
                          <h4 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Accepted Players ({(team.players?.length || 0) + 1}/{team.total_players})
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(0, 229, 155, 0.1)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(0, 229, 155, 0.2)" }}>
                              <CheckCircle size={16} color="var(--primary)" />
                              <span>You (Creator)</span>
                            </div>
                            {team.players && team.players.map(player => (
                              <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                                <CheckCircle size={16} color="var(--primary)" />
                                <span>{player.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {!team.turf_id && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ width: "100%", marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                            onClick={() => handleOpenBookingModal(team)}
                          >
                            🔍 Search & Book Turf
                          </button>
                        )}

                        <button className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} onClick={() => openChat(team)}>
                          Open Match Chat
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <h2 style={{ marginTop: "3rem", marginBottom: "1rem" }}>Teams You Joined</h2>
              {joinedTeams.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <Users size={48} color="var(--text-muted)" style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                  <p style={{ color: "var(--text-muted)" }}>{"You haven't joined any teams yet."}</p>
                </div>
              ) : (
                <div className="match-list">
                  {joinedTeams.map(team => {
                    const { date, time } = formatDateTime(team.start_time);
                    return (
                      <div key={team.id} className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                          <div>
                            <h3>{team.name} <span style={{ fontSize: "0.875rem", fontWeight: "normal", color: "var(--text-muted)" }}>({date} @ {team.turf_name || "TBD"})</span></h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "0.25rem 0 0 0" }}>Hosted by {team.host_name}</p>
                          </div>
                          <span className="badge badge-green" style={{ background: "rgba(0, 229, 155, 0.15)", color: "var(--primary)", border: "1px solid rgba(0, 229, 155, 0.3)" }}>
                            Joined
                          </span>
                        </div>

                        <div style={{ marginBottom: "1.5rem" }}>
                          <h4 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Accepted Players ({(team.players?.length || 0) + 1}/{team.total_players})
                          </h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.03)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                              <CheckCircle size={16} color="var(--primary)" />
                              <span>{team.host_name} (Creator)</span>
                            </div>
                            {team.players && team.players.map(player => (
                              <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: player.id === currentUserId ? "rgba(0, 229, 155, 0.1)" : "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "8px", border: player.id === currentUserId ? "1px solid rgba(0, 229, 155, 0.2)" : "1px solid var(--border-color)" }}>
                                <CheckCircle size={16} color="var(--primary)" />
                                <span>{player.id === currentUserId ? "You" : player.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => openChat(team)}>
                          Open Match Chat
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MY PROFILE TAB (Reputation & Gamification) */}
          {activeTab === 'profile' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Profile Header Card with Avatar Upload */}
              <div className="card" style={{ display: "flex", alignItems: "center", gap: "1.5rem", background: "linear-gradient(135deg, rgba(0, 229, 155, 0.1), rgba(0,0,0,0.4))", border: "1px solid rgba(0, 229, 155, 0.2)" }}>
                <div 
                  onClick={() => document.getElementById('avatar-upload-input').click()}
                  style={{ 
                    width: "80px", height: "80px", borderRadius: "50%", 
                    background: avatarUrl ? `url(${avatarUrl}) center/cover` : "var(--primary)", 
                    display: "flex", alignItems: "center", justifyContent: "center", 
                    fontSize: "2rem", fontWeight: "bold", color: "#000",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                    border: "3px solid rgba(0, 229, 155, 0.4)",
                    transition: "border-color 0.3s ease"
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0, 229, 155, 0.4)'}
                >
                  {!avatarUrl && !avatarUploading && currentUserName.charAt(0)}
                  {avatarUploading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "24px", height: "24px", border: "3px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    </div>
                  )}
                  {!avatarUploading && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", padding: "2px 0", display: "flex", justifyContent: "center" }}>
                      <Camera size={12} color="#fff" />
                    </div>
                  )}
                  <input 
                    id="avatar-upload-input"
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { alert('Avatar must be under 5MB'); return; }
                      setAvatarUploading(true);
                      try {
                        const res = await fetch('/api/media/upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ file_name: file.name, content_type: file.type, asset_type: 'avatar' })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          // For mock mode, use a local object URL for instant visual preview
                          if (data.is_mock) {
                            setAvatarUrl(URL.createObjectURL(file));
                          } else {
                            // Production: PUT file directly to pre-signed GCS URL
                            await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
                            setAvatarUrl(data.asset_url);
                          }
                        }
                      } catch (err) {
                        console.error('Avatar upload error:', err);
                      } finally {
                        setAvatarUploading(false);
                      }
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h2 style={{ margin: 0, color: "var(--text-main)" }}>{currentUserName}</h2>
                    <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>Verified Athlete</span>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    Primary Role: <span style={{ color: "var(--primary)", textTransform: "capitalize" }}>{userProfile?.role || 'Player'}</span>
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    Tap avatar to upload a profile photo
                  </p>
                </div>
              </div>

              {/* Reputation & Attendance Engine */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <Award size={36} color="var(--primary)" style={{ marginBottom: "0.5rem" }} />
                  <span style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--text-main)" }}>
                    {userProfile?.reputation_score ? parseFloat(userProfile.reputation_score).toFixed(0) : '100'}
                  </span>
                  <h4 style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reputation Score</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Based on fair play and verification.</p>
                </div>

                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <UserCheck size={36} color="#00e59b" style={{ marginBottom: "0.5rem" }} />
                  <span style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--text-main)" }}>
                    {userProfile?.attendance_score ? parseFloat(userProfile.attendance_score).toFixed(0) : '100'}%
                  </span>
                  <h4 style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Attendance Rate</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Matches attended without dropouts.</p>
                </div>
              </div>

              {/* Push Notifications Reactivation Trigger */}
              <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
                    <Bell size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.125rem" }}>Match Push Notifications</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>Get instant browser alerts when your requests are accepted.</p>
                  </div>
                </div>
                <button 
                  className={`btn ${pushSubscribed ? 'btn-secondary' : 'btn-primary'}`} 
                  onClick={() => setShowPushModal(true)}
                  disabled={pushSubscribed}
                >
                  {pushSubscribed ? "Enabled" : "Enable Alerts"}
                </button>
              </div>

              {/* Preferences Settings */}
              <div className="card">
                <h3 style={{ marginBottom: "1.25rem", color: "var(--primary)" }}>Sports Preferences</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  updateProfilePreferences(formData.get('sports'), formData.get('skill'));
                }} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Preferred Sports</label>
                    <input 
                      type="text" 
                      name="sports" 
                      className="form-input" 
                      defaultValue={userProfile?.preferred_sports || 'Cricket, Football'} 
                      placeholder="e.g. Cricket, Football, Tennis"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Skill Tier</label>
                    <select name="skill" className="form-input" defaultValue={userProfile?.skill_level || 'Beginner'}>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced / Semi-Pro</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
                    Save Preferences
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* CHAT MODAL */}
      {activeChatMatch && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: "500px", height: "80vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            
            <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--primary)" }}>{activeChatMatch.name}</h3>
                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Match Chat</span>
              </div>
              <button onClick={closeChat} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.5rem" }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {chatMessages.map((msg, i) => {
                const isMe = parseInt(msg.sender_user_id) === currentUserId;
                return (
                  <div key={i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "block", textAlign: isMe ? "right" : "left" }}>
                      {isMe ? "You" : msg.sender_name}
                    </span>
                    <div style={{ 
                      background: isMe ? "var(--primary)" : "rgba(255,255,255,0.1)", 
                      color: isMe ? "#000" : "var(--text-main)",
                      padding: "0.75rem 1rem", 
                      borderRadius: "12px",
                      borderBottomRightRadius: isMe ? "0" : "12px",
                      borderBottomLeftRadius: isMe ? "12px" : "0"
                    }}>
                      {msg.message_content}
                    </div>
                  </div>
                )
              })}
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "auto", marginBottom: "auto" }}>
                  No messages yet. Say hello to your team!
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} style={{ padding: "1.25rem", borderTop: "1px solid var(--border-color)", display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.02)" }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Type a message..." 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button type="submit" className="btn btn-primary" disabled={!newMessage.trim()}>Send</button>
            </form>

          </div>
        </div>
      )}

      {/* SOFT PERMISSION INTENT QUALIFICATION MODAL */}
      {showPushModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "1rem" }}>
          <div className="card" style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.25rem", border: "1px solid var(--primary)" }}>
            
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(0, 229, 155, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={28} color="var(--primary)" />
            </div>

            <div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-main)", fontSize: "1.25rem" }}>Never Miss a Match</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0, lineHeight: "1.5" }}>
                Enable alerts to instantly know when nearby matches need players or your requests get accepted.
              </p>
            </div>

            <div style={{ display: "flex", width: "100%", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setShowPushModal(false)}
              >
                Not Now
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={executePushSubscription}
              >
                Allow Alerts
              </button>
            </div>

            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              You can revoke this anytime in your site preferences.
            </span>

          </div>
        </div>
      )}

      {showBookingModal && selectedMatchForBooking && (
        <div className="modal-backdrop" style={{ display: "flex" }}>
          <div className="card modal-content" style={{ maxWidth: "500px", width: "90%", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.5rem" }}>Book Turf for &quot;{selectedMatchForBooking.name}&quot;</h2>
              <button 
                onClick={() => { setShowBookingModal(false); setSelectedMatchForBooking(null); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.25rem" }}
              >
                ✕
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search turfs by name or location..." 
                value={turfSearchQuery}
                onChange={e => setTurfSearchQuery(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "300px", overflowY: "auto", paddingRight: "0.5rem" }}>
              {turfs
                .filter(turf => {
                  const query = turfSearchQuery.toLowerCase();
                  return turf.name.toLowerCase().includes(query) || turf.location.toLowerCase().includes(query);
                })
                .map(turf => (
                  <div key={turf.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <div>
                      <h4 style={{ color: "var(--primary)", fontWeight: "bold" }}>{turf.name}</h4>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.25rem 0 0 0" }}>📍 {turf.location}</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }} onClick={() => handleBookTurf(turf.id)}>
                      Book Turf
                    </button>
                  </div>
                ))}
              {turfs.filter(turf => {
                const query = turfSearchQuery.toLowerCase();
                return turf.name.toLowerCase().includes(query) || turf.location.toLowerCase().includes(query);
              }).length === 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "1rem" }}>No matching turfs found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
