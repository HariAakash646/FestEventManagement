import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Container,
    Flex,
    Heading,
    SimpleGrid,
    Spinner,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const StatCard = ({ label, value, color }) => (
    <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        p={6}
        textAlign="center"
        boxShadow="sm"
    >
        <Text fontSize="sm" color="gray.500" fontWeight="medium" mb={1}>
            {label}
        </Text>
        <Text fontSize="3xl" fontWeight="bold" color={color || "teal.600"}>
            {value}
        </Text>
    </Box>
);

const AdminHomePage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeCount, setActiveCount] = useState(0);
    const [archivedCount, setArchivedCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrganizerStats = async () => {
            setLoading(true);
            try {
                const data = await apiCall("/users?role=Organizer&lite=true");
                if (data.success) {
                    const organizers = data.data || [];
                    setActiveCount(organizers.filter((o) => o.active !== false).length);
                    setArchivedCount(organizers.filter((o) => o.active === false).length);
                }
            } catch {
                // ignore
            } finally {
                setLoading(false);
            }
        };

        fetchOrganizerStats();
    }, []);

    return (
        <Container maxW="900px" py={8} px={4}>
            <Stack gap={8}>
                <Box>
                    <Heading size="xl" color="teal.700" mb={2}>
                        Admin Dashboard
                    </Heading>
                    <Text fontSize="md" color="gray.600">
                        Welcome back! Here's an overview of the platform.
                    </Text>
                </Box>

                <Box
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="xl"
                    p={6}
                    boxShadow="sm"
                >
                    <Text fontSize="sm" color="gray.500" fontWeight="medium" mb={1}>
                        Admin Email
                    </Text>
                    <Text fontSize="lg" fontWeight="semibold" color="teal.700">
                        {user?.email || "—"}
                    </Text>
                </Box>

                {loading ? (
                    <Flex justify="center" py={8}>
                        <Spinner size="lg" color="teal.500" />
                    </Flex>
                ) : (
                    <SimpleGrid columns={{ base: 1, sm: 2 }} gap={6}>
                        <StatCard
                            label="Active Organizations"
                            value={activeCount}
                            color="green.600"
                        />
                        <StatCard
                            label="Archived Organizations"
                            value={archivedCount}
                            color="red.500"
                        />
                    </SimpleGrid>
                )}

                <Box>
                    <Button
                        colorPalette="teal"
                        size="lg"
                        borderRadius="xl"
                        onClick={() => navigate("/admin/register")}
                    >
                        Register New Organizer
                    </Button>
                </Box>
            </Stack>
        </Container>
    );
};

export default AdminHomePage;