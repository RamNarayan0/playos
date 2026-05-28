"use client";

import { useState, useEffect } from "react";
import { Zap, LogOut, Building2, MapPin, DollarSign, Calendar, Clock, CheckCircle, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import io from "socket.io-client";

export default function OwnerDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("turfs"); // turfs, schedule
  const [socket, setSocket] = useState(null);

  const [turfs, setTurfs] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Use real user from session
  const currentUserName = session?.user?.name || "Box Admin";

  // Create Turf Form State
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    price: "",
    features: ""
  });

  useEffect(() => {
    // Initialize Socket.io
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("match_updated", (updatedMatch) => {
      // In a real app, we'd fetch owner matches again or update state directly
      fetchBookings();
    });

    // Fetch initial data
    fetchTurfs();
    fetchBookings();

    return () => newSocket.close();
  }, []);

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

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/owner/matches");
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  const handleCreateTurf = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      const res = await fetch("/api/turfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormData({ name: "", location: "", price: "", features: "" });
        fetchTurfs();
      }
    } catch (e) {
      console.error("Failed to create turf", e);
    }
  };

  const handleAcceptBooking = async (bookingId) => {
    // For MVP, owner "accepting a booking" just means marking it confirmed. 
    // If we want it to affect DB, we'd need an API. For now, simulate locally.
    setBookings(bookings.map(booking => {
      if (booking.id === bookingId) {
        return { ...booking, status: "Confirmed" };
      }
      return booking;
    }));
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
                <Building2 size={14} color="#000" />
              </div>
              <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>{currentUserName}</span>
            </div>

            <div className="navbar-logo" style={{ marginLeft: "1rem", paddingLeft: "1rem", borderLeft: "1px solid var(--border-color)" }}>
              <Zap size={24} color="var(--primary)" />
              PLAYOS <span style={{ fontSize: "1rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>| Box Owner</span>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={handleSignOut} style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </nav>

      <main className="container hero" style={{ paddingTop: "100px", minHeight: "calc(100vh - 72px)" }}>
        
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'turfs' ? 'active' : ''}`} onClick={() => setActiveTab('turfs')}>
            <Building2 size={18} /> My Turfs
          </button>
          <button className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
            <Calendar size={18} /> Schedule & Bookings
          </button>
        </div>

        <div className="tab-content" style={{ width: "100%", maxWidth: "800px", marginTop: "2rem" }}>
          
          {/* MY TURFS TAB */}
          {activeTab === 'turfs' && (
            <div>
              <div className="card" style={{ marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "1.5rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <PlusCircle size={20} /> Register a New Turf
                </h2>
                <form onSubmit={handleCreateTurf} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Turf Name</label>
                    <input type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Skyline Box Cricket" />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Location</label>
                    <input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required placeholder="Street address or Area" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Price per Hour</label>
                      <input type="text" className="form-input" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required placeholder="e.g. $40/hr" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Key Features</label>
                      <input type="text" className="form-input" value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} required placeholder="e.g. Floodlights, Parking" />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                    List Turf on PLAYOS
                  </button>
                </form>
              </div>

              <h2 style={{ marginBottom: "1rem" }}>Your Listed Turfs</h2>
              <div className="match-list">
                {turfs.map(turf => (
                  <div key={turf.id} className="card match-card" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div>
                        <h3 style={{ fontSize: "1.25rem", color: "var(--primary)" }}>{turf.name}</h3>
                      </div>
                      <div className="badge badge-green" style={{ background: "rgba(255, 255, 255, 0.1)", color: "var(--text-main)" }}>Active</div>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={16} color="var(--text-muted)" />
                        <span>{turf.location}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <DollarSign size={16} color="var(--text-muted)" />
                        <span>{turf.price || '$30/hr'}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", gridColumn: "span 2" }}>
                        <Zap size={16} color="var(--text-muted)" />
                        <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Features: {turf.features || 'Floodlights, AC'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCHEDULE & BOOKINGS TAB */}
          {activeTab === 'schedule' && (
            <div>
              <h2 style={{ marginBottom: "1rem" }}>Booking Requests & Schedule</h2>
              <div className="match-list">
                {bookings.map(booking => {
                  const { date, time } = formatDateTime(booking.start_time);
                  const isConfirmed = booking.status === 'Confirmed' || booking.status === 'OPEN';
                  return (
                    <div key={booking.id} className="card" style={{ borderLeft: isConfirmed ? "4px solid var(--primary)" : "4px solid #f5a623" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 style={{ fontSize: "1.125rem", color: "var(--text-main)" }}>{booking.name}</h3>
                          <p style={{ color: "var(--primary)", fontSize: "0.875rem", fontWeight: "600", marginTop: "0.25rem" }}>@ {booking.turf_name}</p>
                        </div>
                        <div className={`badge ${isConfirmed ? 'badge-green' : ''}`} style={!isConfirmed ? { background: "rgba(245, 166, 35, 0.1)", color: "#f5a623" } : {}}>
                          {isConfirmed ? 'Confirmed' : 'Pending'}
                        </div>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Calendar size={16} color="var(--text-muted)" />
                          <span>{date}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Clock size={16} color="var(--text-muted)" />
                          <span>{time}</span>
                        </div>
                      </div>

                      {!isConfirmed ? (
                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => handleAcceptBooking(booking.id)}>
                          Approve Booking
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                          <CheckCircle size={16} color="var(--primary)" />
                          <span style={{ fontSize: "0.875rem" }}>Host Contact: {booking.host_contact || 'Hidden'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
